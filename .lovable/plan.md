

# Plano: Adicionar logs de requisições API na aba API

## Objetivo
Criar uma tabela de logs e registrar todas as requisições feitas à Platform API, exibindo-as na aba API das Configurações.

## 1. Migração: criar tabela `api_request_logs`
```sql
CREATE TABLE public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  request_body jsonb DEFAULT null,
  response_summary text DEFAULT null,
  ip_address text DEFAULT null,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api logs"
  ON public.api_request_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_api_logs_user_created ON public.api_request_logs(user_id, created_at DESC);
```

Apenas INSERT pelo service_role (backend), SELECT pelo usuário autenticado.

## 2. Backend: logar cada requisição em `platform-api.ts`

Criar uma função `logApiRequest` que faz insert na tabela após cada endpoint processar:

```typescript
async function logApiRequest(userId: string, req: Request, statusCode: number, responseSummary?: string) {
  const sb = getServiceClient();
  await sb.from("api_request_logs").insert({
    user_id: userId,
    method: req.method,
    path: req.originalUrl || req.path,
    status_code: statusCode,
    request_body: req.body && Object.keys(req.body).length ? req.body : null,
    response_summary: responseSummary?.substring(0, 500),
    ip_address: req.ip || req.socket.remoteAddress,
  });
}
```

Inserir chamadas a `logApiRequest` nos endpoints principais: send-message, send-media, contacts, transactions, reminders, tags, validate-number, webhook de entrada.

## 3. Frontend: componente de logs na aba API

Adicionar um segundo Card abaixo do existente em `IntegrationApiSection.tsx`:

- Busca últimos 50 logs de `api_request_logs` ordenados por `created_at DESC`
- Exibe em tabela com colunas: Data/Hora, Método, Path, Status, Resumo
- Badge colorido no status (verde 2xx, amarelo 4xx, vermelho 5xx)
- Botão "Atualizar" para recarregar
- Auto-refresh a cada 30 segundos
- Linha expansível para ver o `request_body` formatado

## Arquivos modificados
1. **Migração SQL** -- tabela `api_request_logs`
2. **`deploy/backend/src/routes/platform-api.ts`** -- função `logApiRequest` + chamadas em cada endpoint
3. **`src/components/settings/IntegrationApiSection.tsx`** -- seção de logs com tabela

