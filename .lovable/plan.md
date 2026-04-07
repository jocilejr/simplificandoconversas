

# Correção: Aplicar migração de workspace diretamente na VPS

## Diagnóstico final confirmado

| Dado | Valor |
|------|-------|
| `workspace_id` nas tabelas | **NÃO EXISTE** |
| Workspaces criados | **0** |
| Workspace members | **0** |
| Dados intactos | **SIM** (4 flows, 5 instances, 1 ai_config, 1 smtp, 3 transactions) |

**Causa raiz:** O `update.sh` usa `set -e` + `ON_ERROR_STOP=1`. Alguma instrução SQL anterior ao bloco de workspace falha (provavelmente um conflito de FK ou constraint em tabelas já existentes), abortando o script inteiro antes de chegar na migração de workspace.

## Solução

Em vez de depender do `update.sh` monolítico, vou criar um script SQL **separado** (`deploy/migrate-workspace.sql`) contendo APENAS a migração de workspace. Isso permite rodar isoladamente na VPS sem depender do resto do script.

Além disso, vou modificar o `update.sh` para:
1. **Remover `ON_ERROR_STOP=1`** do bloco SQL principal de tabelas pré-existentes (que só faz `IF NOT EXISTS` e `ADD COLUMN IF NOT EXISTS`)
2. **Manter `ON_ERROR_STOP=1`** apenas no bloco de workspace migration
3. Separar em dois blocos `psql`: um para tabelas base (tolerante a erros) e outro para workspace (strict)

### Arquivo novo: `deploy/migrate-workspace.sql`

Conteúdo: apenas o bloco de workspace do `update.sh` (linhas 397-689), isolado para execução manual.

### Arquivo modificado: `deploy/update.sh`

Separar o heredoc SQL em dois blocos `psql`:
- Bloco 1 (sem `ON_ERROR_STOP`): criação de tabelas base com `IF NOT EXISTS` — erros em constraints duplicadas são ignorados
- Bloco 2 (com `ON_ERROR_STOP`): migração de workspace — precisa funcionar por completo

### Instruções para rodar na VPS

Após o deploy:
```bash
cd ~/simplificandoconversas && git pull origin main

# Rodar APENAS a migração de workspace
cd deploy
docker compose exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 < migrate-workspace.sql

# Verificar resultado
docker compose exec -T postgres psql -U postgres -d postgres -c "
SELECT * FROM public.workspaces;
SELECT * FROM public.workspace_members;
"

# Rebuild e restart
bash update.sh
```

## Resultado esperado

- Workspace "Workspace Principal" criado para o usuário
- Membership admin criada automaticamente
- `workspace_id` preenchido em todos os 4 flows, 5 instances, etc.
- Frontend passa a exibir tudo normalmente

