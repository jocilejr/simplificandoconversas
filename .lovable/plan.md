
Problema confirmado: o deploy da VPS está com o código novo, mas o banco local da VPS não recebeu a criação da tabela `api_request_logs`.

O que verifiquei no código:
- `deploy/backend/src/routes/platform-api.ts` já chama `logApiRequest(...)`
- `deploy/backend/src/routes/external-webhook.ts` também tenta inserir em `api_request_logs`
- a migration `supabase/migrations/20260401041948_8e266261-7f7a-4fb8-a03a-1e3ff54364b8.sql` existe
- porém o script `deploy/update.sh` não executa as migrations da pasta `supabase/migrations/`; ele só roda um bloco SQL fixo e esse bloco não inclui `api_request_logs`

Conclusão:
- o `bash update.sh` recompila o backend, então `logApiRequest` existe no container
- mas a tabela nunca foi criada na VPS
- por isso os inserts de log falham silenciosamente e nada aparece na aba API

Plano de correção

1. Corrigir o deploy da VPS
- Atualizar `deploy/update.sh` para incluir a criação de `public.api_request_logs`
- Incluir também:
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
  - policy de `SELECT` para o usuário autenticado
  - índice `user_id, created_at DESC`
- Adicionar uma verificação explícita pós-migração, igual já existe para `meta_pixels`, mas para `api_request_logs`

2. Melhorar o diagnóstico no backend
- Em `logApiRequest`, manter o `catch`, mas logar o erro de forma mais específica
- Se a tabela não existir, o backend deve imprimir algo claro como falha ao inserir em `api_request_logs`
- Fazer o mesmo padrão no `external-webhook.ts`, que hoje também falha em silêncio na prática

3. Ajustar a UX do painel de logs
- Em `src/components/settings/ApiLogsPanel.tsx`, capturar e mostrar erro de leitura quando a tabela não existir ou a query falhar
- Exibir estado de erro visível no card, em vez de simplesmente parecer que “não há logs”

4. Validação na sua VPS
Depois da implementação, você vai rodar na VPS:
```bash
cd /root/simplificandoconversas/deploy
bash update.sh

docker compose exec postgres psql -U postgres -d postgres -c "\d public.api_request_logs"
docker compose exec postgres psql -U postgres -d postgres -c "SELECT count(*) FROM public.api_request_logs;"
```

5. Teste ponta a ponta na VPS
- Fazer uma chamada real para `/api/platform/send-message`
- Conferir:
```bash
docker compose logs backend --tail=100 | grep -i "logApiRequest\|api_request_logs\|send-message"
docker compose exec postgres psql -U postgres -d postgres -c "SELECT method, path, status_code, created_at FROM public.api_request_logs ORDER BY created_at DESC LIMIT 10;"
```
- Depois abrir a aba API no app da VPS e validar se os registros aparecem

Detalhes técnicos
- A causa não é RLS do frontend
- A causa também não é falta de deploy do backend
- A causa é exclusivamente o fluxo de migração da VPS: o arquivo `supabase/migrations/...sql` existe no repositório, mas o `update.sh` não o aplica
- Ou seja: hoje seu processo de deploy atualiza código, mas não sincroniza todas as mudanças de schema

Arquivos a ajustar
- `deploy/update.sh`
- `deploy/backend/src/routes/platform-api.ts`
- `deploy/backend/src/routes/external-webhook.ts`
- `src/components/settings/ApiLogsPanel.tsx`
