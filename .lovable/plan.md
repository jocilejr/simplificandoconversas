

## Diagnóstico confirmado

1. **`api_request_logs` não existe na VPS** → erro "relation does not exist" no painel de logs.
2. **`platform_connections` existe**, mas:
   - `workspace_id` é **nullable** (não NOT NULL) → o registro custom_api foi salvo com `workspace_id = NULL`.
   - Já tem 1 registro custom_api do user `67eeaedb...` com `workspace_id = NULL`.
3. **RLS está ativo** com `is_workspace_member(workspace_id)` no SELECT → como o registro tem `workspace_id = NULL`, **a política bloqueia o SELECT**, então o frontend acha que "não existe" e gera nova chave toda vez. Esse é o bug raiz da não-persistência.

## Correções

### 1. SQL na VPS (script único — vai dentro de `deploy/init-db.sql` para idempotência futura + aplicado direto agora)

```sql
-- A. Criar tabela api_request_logs
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  request_body jsonb,
  response_summary text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_logs_workspace_created
  ON public.api_request_logs(workspace_id, created_at DESC);
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ws_select ON public.api_request_logs;
CREATE POLICY ws_select ON public.api_request_logs FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
GRANT SELECT, INSERT ON public.api_request_logs TO service_role;

-- B. Backfill workspace_id no registro órfão de platform_connections
UPDATE public.platform_connections pc
SET workspace_id = wm.workspace_id
FROM public.workspace_members wm
WHERE pc.workspace_id IS NULL
  AND pc.user_id = wm.user_id
  AND wm.role = 'admin';

-- C. Garantir índice único por (workspace_id, platform) para upsert
CREATE UNIQUE INDEX IF NOT EXISTS uniq_platform_conn_ws_platform
  ON public.platform_connections(workspace_id, platform)
  WHERE workspace_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
```

### 2. Frontend — `src/components/settings/IntegrationApiSection.tsx`
- Garantir que **toda query** (SELECT/INSERT/UPDATE) em `platform_connections` filtre/inclua `workspace_id` do `useWorkspace`.
- No INSERT, sempre setar `workspace_id`.
- No SELECT, filtrar por `.eq("workspace_id", workspaceId).eq("platform", "custom_api")` (em vez de só `user_id` + platform).

### 3. Backend — `deploy/backend/src/routes/extension-api.ts` (e/ou onde valida API key)
- Confirmar que a validação da API key não depende de `workspace_id` no registro (já usa só `credentials->>'api_key'`), mas resolver `workspace_id` a partir do `user_id` quando precisar logar.

### 4. Persistir no `init-db.sql` para novas instalações
Adicionar o bloco da tabela `api_request_logs` ao `deploy/init-db.sql`.

## Comandos para você rodar agora na VPS

Vou gerar o SQL pronto e você cola direto. Após aplicar o plano, eu te entrego o bloco `docker exec ... psql ... <<SQL` finalizado + o `git pull && bash deploy/update.sh`.

## Risco

Baixo. A tabela é nova (não quebra nada). O backfill só preenche `workspace_id` onde está NULL. O índice único é criado com `WHERE workspace_id IS NOT NULL` para evitar conflito com legados.

