

## Plano: Impedir que materiais sejam apagados no update

### Causa raiz
O arquivo `deploy/fix-member-tables.sql` contém nas linhas 102-105:
```sql
DROP TABLE IF EXISTS public.member_product_materials CASCADE;
DROP TABLE IF EXISTS public.member_product_categories CASCADE;
```

E o `deploy/update.sh` executa esse script **toda vez** que roda (linha 464):
```bash
docker compose exec -T postgres psql -U postgres -d postgres < "$DEPLOY_DIR/fix-member-tables.sql"
```

Resultado: cada deploy apaga todos os materiais e categorias da área de membros.

### Correção

**Arquivo: `deploy/fix-member-tables.sql`**

Substituir o `DROP TABLE + CREATE TABLE` por `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS` para cada coluna. Isso torna o script idempotente sem destruir dados.

Especificamente:
1. Remover as linhas `DROP TABLE IF EXISTS public.member_product_materials CASCADE` e `DROP TABLE IF EXISTS public.member_product_categories CASCADE`
2. Substituir os `CREATE TABLE` por `CREATE TABLE IF NOT EXISTS`
3. Adicionar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para cada coluna que possa estar faltando

### Resultado esperado
- O `update.sh` continuará rodando o script normalmente
- Tabelas existentes com dados serão preservadas
- Colunas novas serão adicionadas sem destruir as existentes
- Os materiais cadastrados sobreviverão aos deploys

### Arquivos modificados
- `deploy/fix-member-tables.sql` — tornar idempotente (sem DROP TABLE)

