

## Diagnóstico Final

Há **dois problemas distintos** identificados nos logs:

### 1. check-timeouts: RESOLVIDO
O erro de JSON desapareceu. Agora só aparece `Using URL: http://nginx:80, key length: 199` sem erro. O fix do `default_server` funcionou.

### 2. Webhooks da Evolution API: 404 (PROBLEMA REAL)
Os logs da Evolution mostram:
```
url: 'http://backend:3001/api/webhook/group-participants-update'
message: 'Request failed with status code 404'
```

**Causa raiz**: A Evolution API v2.3.7 com `WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS: "true"` envia webhooks para sub-paths por evento:
- `http://backend:3001/api/webhook/messages-upsert`
- `http://backend:3001/api/webhook/connection-update`
- `http://backend:3001/api/webhook/group-participants-update`

Mas o backend Express só registra `router.post("/")` que corresponde a `/api/webhook` exato. Todas as sub-rotas retornam 404. **Nenhuma mensagem chega.**

## Plano de Correção

### Alteração 1: `deploy/backend/src/routes/webhook.ts` (linha 81)
Mudar de:
```typescript
router.post("/", async (req, res) => {
```
Para:
```typescript
router.post("/*", async (req, res) => {
```

Isso faz o router aceitar `/api/webhook`, `/api/webhook/messages-upsert`, `/api/webhook/group-participants-update`, etc. O corpo do webhook já contém `body.event` que identifica o tipo, então a lógica interna não muda.

### Deploy
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose up -d --build backend
docker compose logs backend --tail=20 -f
```

Depois envie uma mensagem WhatsApp de teste e observe os logs — deve aparecer `Webhook event: messages.upsert`.

