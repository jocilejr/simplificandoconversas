

## Problema

O n8n enviou **uma vez** um payload para o endpoint `mercadopago`, mas o backend registrou "MP webhook without data.id", ou seja, o payload não tem a estrutura `{ data: { id: "..." } }` esperada pelo Mercado Pago.

Todos os outros logs são testes manuais com IDs fictícios (123456, 999).

## Solução

Alterar `deploy/backend/src/routes/webhook-transactions.ts` para:

1. **Logar o body completo** quando `data.id` não for encontrado (para diagnóstico)
2. **Aceitar o payment ID de múltiplos caminhos** no body, cobrindo formatos que o n8n pode usar:
   - `body.data.id` (padrão MP)
   - `body.id`
   - `body.payment_id`
   - `body.resource` (outro formato MP)

## Alteração no arquivo

**Arquivo:** `deploy/backend/src/routes/webhook-transactions.ts`

No bloco do `source === "mercadopago"`, trocar a extração do `paymentId` de:

```typescript
const paymentId = req.body?.data?.id;
if (!paymentId) {
  console.warn(`[webhook-transactions] MP webhook without data.id — acknowledging`);
  return res.json({ ok: true, skipped: true, reason: "no_data_id" });
}
```

Para:

```typescript
const paymentId = req.body?.data?.id 
  || req.body?.id 
  || req.body?.payment_id 
  || req.body?.resource;

if (!paymentId) {
  console.warn(`[webhook-transactions] MP webhook without data.id — body keys: ${JSON.stringify(Object.keys(req.body || {}))} — full body: ${JSON.stringify(req.body).substring(0, 500)}`);
  return res.json({ ok: true, skipped: true, reason: "no_data_id" });
}
```

## Pós-deploy

Após rebuild na VPS (`docker compose up -d --build backend`):

1. Disparar um evento real pelo n8n novamente
2. Verificar logs: `docker compose logs -f backend 2>&1 | grep -i "webhook-transactions"`
3. Se ainda aparecer "without data.id", o log agora mostrará **exatamente** quais campos o n8n está enviando, permitindo ajuste final

