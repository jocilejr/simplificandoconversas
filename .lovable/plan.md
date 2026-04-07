

## Problema

O endpoint `/webhook/boleto` tem uma falha de lógica:

1. Recebe `resource` do IPN do Mercado Pago (ex: `152800261621`)
2. Tenta encontrar a transação no banco por `external_id` para descobrir o `user_id` e buscar o token do MP
3. Se não encontra, retorna 200 silenciosamente — **nunca chega a chamar a API do MP**

O `resource` deveria ser usado para chamar `GET /v1/payments/{id}` na API do MP e obter os detalhes do pagamento. Mas o código precisa de um token de usuário para fazer essa chamada, e usa a busca no banco para descobrir qual token usar.

Quando o `external_id` não bate (ex: veio como URL completa, ou a transação foi criada com ID diferente), o webhook falha silenciosamente.

## Solução

Inverter a lógica do `/webhook/boleto`:

1. Extrair o ID numérico do `resource` (tratar URL ou ID puro)
2. **Primeiro**, tentar encontrar a transação por `external_id` para pegar o token do usuário (caminho rápido)
3. **Se não encontrar**, buscar TODOS os tokens de MP ativos na tabela `platform_connections` e tentar cada um contra a API do MP até um funcionar
4. Com os dados do MP em mãos, encontrar a transação por `external_id` OU criar uma nova se não existir
5. Atualizar status, metadata e recovery queue normalmente

## Mudanças

| Arquivo | Alteracao |
|---------|-----------|
| `deploy/backend/src/routes/payment.ts` | Refatorar `/webhook/boleto` para extrair ID numérico do resource, tentar todos os tokens disponíveis quando a transação não é encontrada, e criar transação nova se necessário |

## Detalhe tecnico

```text
IPN chega → extrair paymentId numerico
  ↓
Buscar transacao por external_id
  ├─ ENCONTROU → pegar token do user → chamar MP API → atualizar
  └─ NAO ENCONTROU → listar todos platform_connections do MP
       ↓
       Para cada token: chamar GET /v1/payments/{paymentId}
         ├─ 200 OK → temos os dados do MP
         │    ↓
         │    Buscar transacao por external_id novamente (agora com ID limpo)
         │    ├─ ENCONTROU → atualizar
         │    └─ NAO ENCONTROU → criar nova transacao com os dados do MP
         └─ 401/404 → tentar proximo token
```

### Extração do ID numerico

```typescript
let rawResource = req.body?.resource || req.body?.data?.id || req.query?.id;
// MP IPN pode enviar: "152800261621" ou "https://api.mercadopago.com/v1/payments/152800261621"
const paymentId = typeof rawResource === "string" && rawResource.includes("/")
  ? rawResource.split("/").pop()
  : String(rawResource);
```

### Fallback: buscar todos os tokens

```typescript
const { data: allConnections } = await supabase
  .from("platform_connections")
  .select("user_id, credentials")
  .eq("platform", "mercadopago")
  .eq("enabled", true);
```

### Log detalhado do body

Adicionar `console.log("[boleto-webhook] Full body:", JSON.stringify(req.body))` para facilitar debug futuro.

## Apos deploy na VPS

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

Depois, reenviar o webhook do n8n e verificar:
```bash
docker logs deploy-backend-1 --tail 30 2>&1 | grep "boleto-webhook"
```

