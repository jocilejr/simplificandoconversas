

## Diagnóstico

Dois problemas confirmados:

**1. Tabela `group_events` não existe** → causa o `insert error: undefined` (Supabase retorna erro vazio quando relação não existe). Por isso o webhook nunca grava nada, mesmo nos casos válidos do "Número Backup dos Grupos".

**2. `group_not_selected` para "Número das Entregas 02"** → essa instância não tem grupos cadastrados em `group_selected` (só "Número Backup dos Grupos" tem 20). É comportamento esperado — só processa grupos monitorados. **Não é bug**, é filtro funcionando.

A correção real é só criar a tabela. Eventos do "Número Backup dos Grupos" começarão a ser gravados imediatamente após o deploy.

## Plano

### 1. Adicionar `CREATE TABLE group_events` em `deploy/init-db.sql`

Bloco idempotente, roda em todo `update.sh`:

```sql
CREATE TABLE IF NOT EXISTS public.group_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL,
  instance_name   text NOT NULL,
  group_jid       text NOT NULL,
  group_name      text,
  participant_jid text NOT NULL,
  action          text NOT NULL CHECK (action IN ('add','remove')),
  raw_payload     jsonb,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_events_ws_time
  ON public.group_events (workspace_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_events_ws_group_time
  ON public.group_events (workspace_id, group_jid, occurred_at DESC);

ALTER TABLE public.group_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ws_select ON public.group_events;
CREATE POLICY ws_select ON public.group_events FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

NOTIFY pgrst, 'reload schema';
```

Sem RLS de INSERT — gravação só pelo backend via service_role (BYPASSRLS).

### 2. Melhorar log de erro em `groups-webhook.ts`

Trocar `console.error("[groups-webhook] insert error:", insertErr.message)` por log com objeto completo (`code`, `details`, `hint`, `message`) — para futuros erros não aparecerem como `undefined`.

### 3. Comandos para você rodar na VPS após eu aplicar

```bash
cd ~/simplificandoconversas && git pull && bash deploy/update.sh
```

### 4. Validação pós-deploy (te mando depois)

- `SELECT COUNT(*) FROM group_events;` deve crescer conforme add/remove acontecem
- Endpoint `/api/groups/events-live` deve retornar `200`
- Modal "Eventos em tempo real" deve preencher

## Arquivos alterados

- `deploy/init-db.sql` — bloco CREATE TABLE + índices + RLS
- `deploy/backend/src/routes/groups-webhook.ts` — log estruturado do erro de insert

## Risco

Zero. `IF NOT EXISTS` é idempotente.

