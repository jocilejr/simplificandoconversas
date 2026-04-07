

# Correção: Migração de Workspaces nunca executou na VPS

## Diagnóstico confirmado

- **profiles = 1** — seu perfil existe
- **workspace_members = 0** — nenhum workspace vinculado
- **workspaces = 0** — nenhum workspace criado  
- **`workspace_id` column does not exist** nas tabelas de dados — a migração SQL NUNCA rodou

**Causa raiz:** O `update.sh` tem `set -e` (para no primeiro erro). O frontend build ou o `docker compose build backend` falhou (erros TS que corrigimos), e o script abortou **antes** de chegar no bloco SQL de migração. Porém, o bloco SQL roda na etapa `[2.5/4]` que fica DEPOIS do build do frontend (etapa `[2/4]`). Se o `bun run build` falhou, parou ali.

**Boa notícia:** Seus dados estão 100% intactos. Nada foi deletado.

## Plano de correção

### 1. Reorganizar `deploy/update.sh`

Mover a migração SQL para **antes** do build do frontend, para que falhas de build não bloqueiem a migração do banco. Ordem nova:

```text
[1/5] git pull
[2/5] SQL migrations (banco primeiro!)
[3/5] Build frontend
[4/5] Build backend container
[5/5] Restart + health check
```

Remover o bloco destrutivo `DELETE FROM ... WHERE workspace_id IS NULL` (linhas 551-568) e substituir por uma verificação que apenas avisa se houver registros órfãos.

### 2. Instruções imediatas para VPS

Após o deploy, fornecer comando manual para rodar a migração SQL diretamente no postgres, caso o `update.sh` já tenha sido executado parcialmente. Isso garante que:
- O workspace é criado para o usuário `46ed58c8-fb6b-4eb5-ad02-bd54a6c098d6`
- `workspace_id` é preenchido em todos os registros existentes
- RLS policies são atualizadas

### Arquivos modificados

- `deploy/update.sh` — reordenar etapas, remover DELETE destrutivo

### Resultado esperado

Após rodar `bash update.sh` na VPS:
- Workspace criado automaticamente
- Todos os dados existentes vinculados ao workspace
- Frontend exibe tudo normalmente (fluxos, instâncias, configurações)

