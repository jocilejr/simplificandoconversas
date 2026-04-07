

# Problema: Migração de Workspaces não aplicada na VPS

## Diagnóstico

O frontend foi atualizado para filtrar todos os dados por `workspace_id`, mas a migração de banco de dados ainda **não foi aplicada na VPS**. A migração rodou apenas no Lovable Cloud. Resultado: o frontend busca por `workspace_id` que não existe nas tabelas da VPS, e o `useWorkspace` não encontra workspaces, deixando `workspaceId = null`, o que desabilita todas as queries.

## Solução

### 1. Atualizar `deploy/update.sh` com a migração de workspaces

Adicionar o bloco SQL completo da migração (criação do enum `workspace_role`, tabelas `workspaces` e `workspace_members`, funções helper, adição de `workspace_id` em todas as 32 tabelas, migração de dados existentes, novas RLS policies) no script `update.sh`, usando `IF NOT EXISTS` em tudo para ser idempotente.

### 2. Atualizar `deploy/init-db.sql` para novos deploys

Incluir as tabelas `workspaces`, `workspace_members`, enum `workspace_role`, funções helper e `workspace_id` em todas as tabelas para que novas instalações já venham com o schema correto.

### 3. Atualizar backend Express para ser workspace-aware

As rotas do backend (webhook, execute-flow, payment-openpix, etc.) inserem dados diretamente via `service_role`. Elas precisam resolver o `workspace_id` a partir do `user_id` ou da conexão/instância envolvida. Sem isso, inserts no backend falharão por `NOT NULL` no `workspace_id`.

**Arquivos afetados:**
- `deploy/backend/src/routes/webhook.ts` — resolver workspace via `whatsapp_instances` ou `conversations`
- `deploy/backend/src/routes/execute-flow.ts` — idem
- `deploy/backend/src/routes/check-timeouts.ts` — idem  
- `deploy/backend/src/routes/light-sync.ts` — idem
- `deploy/backend/src/routes/payment-openpix.ts` — resolver via `platform_connections`
- `deploy/backend/src/routes/payment.ts` — idem
- `deploy/backend/src/routes/email.ts` — resolver via `smtp_config` ou `email_campaigns`
- `deploy/backend/src/routes/platform-api.ts` — resolver via API key lookup
- `deploy/backend/src/routes/external-webhook.ts` — idem
- `deploy/backend/src/routes/extension-api.ts` — resolver via auth header

**Estratégia:** Criar um helper `resolveWorkspaceId(userId)` que busca o workspace do usuário na tabela `workspace_members`. Usar isso em todas as rotas que precisam inserir dados.

### 4. Passos pós-deploy na VPS

```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && bash update.sh
```

## Ordem de implementação

1. Migração SQL no `update.sh` (idempotente)
2. Atualizar `init-db.sql` para novos deploys
3. Helper `resolveWorkspaceId` no backend
4. Atualizar cada rota do backend para incluir `workspace_id`

## Escopo estimado

- ~200 linhas SQL no update.sh
- ~530 linhas update no init-db.sql  
- ~15 linhas helper no backend
- ~10 rotas do backend com 2-5 linhas cada

