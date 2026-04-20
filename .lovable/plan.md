

## Diagnóstico

O problema principal não parece ser “falta da coluna `workspace_id` em `transactions`”, porque você já confirmou na VPS que ela existe.

O problema mais provável é este:

1. **Instalação nova da VPS fica incompleta/inconsistente**
   - `deploy/install.sh` sobe os containers, mas **não aplica** `migrate-workspace.sql` nem `fix-member-tables.sql`.
   - Já o `deploy/update.sh` aplica:
     - `init-db.sql`
     - `migrate-workspace.sql`
     - `fix-member-tables.sql`

2. **`init-db.sql` sozinho ainda é insuficiente para a versão atual do sistema**
   - nele, `transactions` nasce sem `workspace_id`
   - `platform_connections` nasce sem `workspace_id`
   - depois isso é corrigido pelo `migrate-workspace.sql`

3. Resultado:
   - numa VPS nova, a base pode subir “meio antiga”
   - o PostgREST pode ficar com **cache de schema desatualizado**
   - algumas telas funcionam, outras quebram com erro de coluna/tabela/cache
   - a persistência da API key também sofre com isso

4. Além disso, ainda existe um ponto de código legado:
   - `deploy/backend/src/routes/extension-api.ts` ainda busca/salva `platform_connections` por `user_id`, e não por `workspace_id`
   - isso pode continuar causando comportamento inconsistente mesmo após a migração

---

## Plano

### 1. Corrigir a instalação inicial da VPS
Alterar `deploy/install.sh` para, após subir o Postgres/GoTrue, aplicar exatamente o mesmo pacote de migração do deploy normal:

```text
init-db.sql
+ migrate-workspace.sql
+ fix-member-tables.sql
```

Assim a VPS nova já nasce no schema correto.

### 2. Forçar refresh do PostgREST no fluxo de instalação
No final da instalação inicial:
- enviar `NOTIFY pgrst, 'reload schema'`
- reiniciar/forçar refresh do serviço `postgrest`

Isso evita o erro clássico de “column not found in schema cache”.

### 3. Adicionar uma checagem pós-instalação
Incluir no fluxo de instalação uma validação automática das peças mínimas obrigatórias:

```text
public.workspaces
public.workspace_members
public.transactions.workspace_id
public.platform_connections.workspace_id
public.api_request_logs
```

Se algo estiver faltando, o script deve falhar com mensagem clara.

### 4. Corrigir o backend legado da API key
Atualizar `deploy/backend/src/routes/extension-api.ts` para:
- carregar chave por `workspace_id + platform`
- atualizar por `workspace_id + platform`
- inserir sempre com `workspace_id`

Isso alinha o backend com o frontend novo e evita recriação infinita de chave.

### 5. Padronizar a recuperação de VPS já instaladas
Manter `deploy/update.sh` como reparo completo para instalações existentes, mas garantir que ele continue:
- aplicando os 3 SQLs
- recarregando schema
- validando a estrutura final

---

## Arquivos que precisam ser ajustados

- `deploy/install.sh`
- `deploy/update.sh` (se precisar reforçar verificação/fallback)
- `deploy/backend/src/routes/extension-api.ts`

Possivelmente também:
- `deploy/init-db.sql` apenas se eu decidir consolidar parte do schema base para reduzir dependência do passo seguinte

---

## Validação na VPS

Depois da implementação, a validação deve ser feita dentro da VPS com este fluxo:

```bash
cd /opt/simplificandoconversas
bash deploy/update.sh
```

E depois conferir:

```bash
PG=$(docker ps --format '{{.ID}} {{.Names}}' | awk '$2 ~ /^simplificando_postgres\./ {print $1; exit}')

docker exec -i $PG psql -U postgres -d postgres -c "\d public.transactions"
docker exec -i $PG psql -U postgres -d postgres -c "\d public.platform_connections"
docker exec -i $PG psql -U postgres -d postgres -c "\d public.api_request_logs"
docker exec -i $PG psql -U postgres -d postgres -c "\d public.workspaces"
docker exec -i $PG psql -U postgres -d postgres -c "\d public.workspace_members"
```

E validar no app:
- Configurações → Integração API: chave deve persistir
- Logs de Requisições: deve abrir sem erro
- n8n / integrações externas: transações devem voltar a funcionar sem erro de `workspace_id`

---

## Resultado esperado

Depois disso, a instalação em VPS nova deixa de depender de “correção manual depois do install”, e o sistema passa a subir já com:
- schema completo
- cache do PostgREST coerente
- API key persistente
- logs funcionando
- tabelas de workspace prontas desde o início

