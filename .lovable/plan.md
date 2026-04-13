

## Problema encontrado

A rota `platform-api.ts` (usada por requisições externas/API) **não define `date_of_expiration`** ao criar boletos no Mercado Pago. Diferente de `payment.ts` e `member-purchase.ts` que já têm 7 dias, esta rota envia o boleto sem prazo — e o Mercado Pago aplica o default de 3 dias.

## Correção

### Arquivo: `deploy/backend/src/routes/platform-api.ts`

Adicionar a expiração de 7 dias logo após o bloco de endereço (após linha 1136):

```typescript
if (paymentType === "boleto") {
  // ... existing address block ...

  // Set 7-day expiration
  const expDate = new Date();
  expDate.setDate(expDate.getDate() + 7);
  paymentBody.date_of_expiration = expDate.toISOString();
}
```

Isso alinha o comportamento com as outras duas rotas que já funcionam corretamente.

## Após o deploy

Rode na VPS para confirmar:
```bash
docker exec -i deploy-backend-1 grep -n "getDate" /app/src/routes/platform-api.ts
```

Deve retornar a linha com `+ 7`.

