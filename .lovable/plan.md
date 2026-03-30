
Objetivo: corrigir a integração do Mercado Pago para que webhooks reais (incluindo boleto) sejam processados sem “falso 502”, com diagnóstico 100% feito na VPS.

Diagnóstico já confirmado
- O `502` atual pode estar vindo do próprio backend (não só gateway): em `deploy/backend/src/routes/webhook-transactions.ts`, quando a API do Mercado Pago falha (`!payment`), a rota responde `502`.
- O teste do MP usa ID fictício (`123456`), então ele tende a gerar `404` na API do MP e virar `502` no seu endpoint (marcando URL como falha).
- O erro `less: not found` nos comandos SQL precisa ser contornado com `psql -P pager=off` (mais confiável que `PAGER=cat` nesse ambiente).

Plano de implementação

1) Confirmar estado real na VPS (pré-fix, com comandos corretos)
- Rodar e me enviar saída de:
  - `docker compose exec -T postgres psql -U postgres -d postgres -P pager=off -c "SELECT platform, enabled, credentials->>'access_token' IS NOT NULL AS has_access_token FROM platform_connections WHERE platform='mercadopago' AND user_id='46ed58c8-fb6b-4eb5-ad02-bd54a6c098d6';"`
  - `docker compose exec -T postgres psql -U postgres -d postgres -P pager=off -c "SELECT id, source, external_id, status, amount, created_at FROM transactions WHERE user_id='46ed58c8-fb6b-4eb5-ad02-bd54a6c098d6' ORDER BY created_at DESC LIMIT 20;"`
  - `curl -i -X POST "https://api.chatbotsimplificado.com/functions/v1/webhook-transactions/mercadopago?user_id=46ed58c8-fb6b-4eb5-ad02-bd54a6c098d6" -H "Content-Type: application/json" -d '{"action":"payment.updated","data":{"id":"123456"}}'`

2) Ajustar backend para webhook do MP não “falhar” por ID de teste
- Arquivo: `deploy/backend/src/routes/webhook-transactions.ts`
- Mudanças:
  - `fetchMercadoPagoPayment` passar a retornar resultado estruturado (`ok/status/body`) em vez de só `null`.
  - No fluxo `mercadopago`:
    - Se MP retornar `404` (ID de teste/inexistente): responder `200` com `{ ok: true, skipped: true, reason: "payment_not_found" }`.
    - Se MP retornar `401/403` (token inválido): responder `200` com `{ ok: true, skipped: true, reason: "invalid_credentials" }` e log explícito para correção de credencial.
    - Manter erro HTTP 5xx apenas para falha interna real (ex.: erro de banco/exception), não para webhook de validação externa.
  - Enriquecer logs com `source`, `user_id`, `payment_id`, `mp_status` para rastreio rápido.

3) Padronizar observabilidade para troubleshooting na VPS
- Garantir logs claros no backend para distinguir:
  - webhook recebido
  - credencial ausente
  - retorno MP 404/401/5xx
  - insert/update na tabela `transactions`
- Assim, cada tentativa de webhook terá um “rastro” único no `docker compose logs backend`.

4) Deploy e validação fim a fim na VPS
- Rebuild/restart:
  - `docker compose up -d --build backend nginx`
- Testes pós-fix:
  - Teste de validação do MP (ID fictício) deve retornar `200` (não 502).
  - Gerar boleto real e verificar:
    - logs de recebimento no backend
    - linha nova em `transactions` para seu `user_id`.
- Consulta final:
  - `docker compose exec -T postgres psql -U postgres -d postgres -P pager=off -c "SELECT source, external_id, status, amount, created_at FROM transactions WHERE user_id='46ed58c8-fb6b-4eb5-ad02-bd54a6c098d6' ORDER BY created_at DESC LIMIT 10;"`

Detalhes técnicos (resumo)
- Fluxo após ajuste:
```text
Mercado Pago webhook -> /functions/v1/webhook-transactions/mercadopago
  -> backend busca payment na API MP
     -> 200 MP: normaliza e grava em transactions
     -> 404/401/403 MP: ACK 200 (skipped + motivo em log)
     -> erro interno: 5xx
```
- Resultado esperado: testes automáticos do Mercado Pago deixam de marcar URL como “quebrada” por ID fake, e eventos reais continuam sendo processados e gravados normalmente.
