

## Plano: Descobrir e impedir o que está apagando materiais/categorias/ofertas

### Situação atual

Após análise exaustiva de todo o código (backend, frontend, SQL scripts, crons):
- **Nenhum código apaga** `member_product_materials`, `member_product_categories` ou `member_area_offers`
- **Nenhum cron** toca essas tabelas
- **Nenhum DROP TABLE** ou TRUNCATE existe nos scripts
- **As FKs são seguras** — `ON DELETE SET NULL` no product_id, `ON DELETE CASCADE` apenas no workspace_id
- Os dados **somem fisicamente do banco** ~10 minutos após o deploy

### Hipótese principal

Se `ON DELETE CASCADE` no `workspace_id` está ativo, e algo recriar/apagar o workspace (por exemplo, o `migrate-workspace.sql` ou um backfill), **todos os materiais, categorias e ofertas daquele workspace seriam apagados em cascata**.

O `migrate-workspace.sql` roda em **todo deploy** e faz backfill de workspaces. Se ele criar um workspace novo com o mesmo `created_by` mas ID diferente, o antigo pode estar sendo removido — levando todos os dados junto.

### Correções

**1. Trocar FK CASCADE por RESTRICT nas tabelas afetadas (SQL na VPS)**

Remover as FKs perigosas de workspace_id com `ON DELETE CASCADE` e recriar com `ON DELETE RESTRICT`:

```sql
-- member_product_categories
ALTER TABLE public.member_product_categories 
  DROP CONSTRAINT IF EXISTS fk_member_product_categories_workspace;
ALTER TABLE public.member_product_categories 
  ADD CONSTRAINT fk_member_product_categories_workspace 
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;

-- member_product_materials  
ALTER TABLE public.member_product_materials 
  DROP CONSTRAINT IF EXISTS fk_member_product_materials_workspace;
ALTER TABLE public.member_product_materials 
  ADD CONSTRAINT fk_member_product_materials_workspace 
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;

-- member_area_offers (tem DUAS FKs de workspace — remover ambas)
ALTER TABLE public.member_area_offers 
  DROP CONSTRAINT IF EXISTS fk_member_area_offers_workspace;
ALTER TABLE public.member_area_offers 
  DROP CONSTRAINT IF EXISTS member_area_offers_workspace_id_fkey;
ALTER TABLE public.member_area_offers 
  ADD CONSTRAINT fk_member_area_offers_workspace 
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
```

Isso fará o Postgres **bloquear** qualquer tentativa de apagar um workspace que tenha dados vinculados — em vez de apagar tudo silenciosamente.

**2. Criar tabela de auditoria + triggers para rastrear deleções**

```sql
CREATE TABLE IF NOT EXISTS public.deletion_audit (
  id serial PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  deleted_at timestamptz DEFAULT now(),
  deleted_by text DEFAULT current_user
);
```

Com triggers em `member_product_materials`, `member_product_categories`, `member_area_offers` e `workspaces` que gravam cada DELETE na tabela de auditoria.

**3. Atualizar `deploy/fix-member-tables.sql`**

Incluir os comandos acima para que todo deploy futuro garanta as FKs seguras.

**4. Monitoramento imediato na VPS**

Antes de implementar, rode estes comandos para capturar a deleção em tempo real:

```bash
# Rodar ANTES do deploy e deixar aberto num terminal
docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "
CREATE TABLE IF NOT EXISTS public.deletion_audit (
  id serial PRIMARY KEY, table_name text, record_id uuid, 
  old_data jsonb, deleted_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_delete() RETURNS trigger AS \$\$
BEGIN
  INSERT INTO deletion_audit(table_name, record_id, old_data)
  VALUES (TG_TABLE_NAME, OLD.id, row_to_json(OLD)::jsonb);
  RETURN OLD;
END; \$\$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_del_materials ON member_product_materials;
CREATE TRIGGER audit_del_materials BEFORE DELETE ON member_product_materials
  FOR EACH ROW EXECUTE FUNCTION audit_delete();

DROP TRIGGER IF EXISTS audit_del_categories ON member_product_categories;
CREATE TRIGGER audit_del_categories BEFORE DELETE ON member_product_categories
  FOR EACH ROW EXECUTE FUNCTION audit_delete();

DROP TRIGGER IF EXISTS audit_del_offers ON member_area_offers;
CREATE TRIGGER audit_del_offers BEFORE DELETE ON member_area_offers
  FOR EACH ROW EXECUTE FUNCTION audit_delete();

DROP TRIGGER IF EXISTS audit_del_workspaces ON workspaces;
CREATE TRIGGER audit_del_workspaces BEFORE DELETE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION audit_delete();
"
```

Depois do deploy, quando os dados sumirem, rode:
```bash
docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT * FROM deletion_audit ORDER BY deleted_at DESC LIMIT 20;
"
```

### Arquivos modificados
- `deploy/fix-member-tables.sql` — trocar CASCADE por RESTRICT + adicionar auditoria

### Resultado esperado
- Deleções em cascata são **bloqueadas** em vez de silenciosas
- Se algo tentar apagar workspace/produto, receberá erro em vez de sucesso
- A tabela de auditoria revela exatamente **o que** e **quando** algo foi apagado

