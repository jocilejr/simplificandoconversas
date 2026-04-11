

## Plano: Registrar transação PIX na lista de transações

### Problema
O fluxo PIX foi simplificado para apenas exibir a chave, mas removeu completamente a chamada ao backend. Por isso, nenhuma transação é registrada na tabela `transactions` quando o usuário confirma o PIX.

### Solução
No `handlePixConfirm`, adicionar a chamada ao backend (`createCharge`) com `payment_method: "pix"` para registrar a intenção de pagamento — exatamente como já é feito para cartão. A chamada será "fire and forget" (não bloqueia o fluxo nem impede de ver a chave PIX).

### Arquivo: `src/components/membros/PaymentFlow.tsx`

Alterar `handlePixConfirm` de:
```typescript
const handlePixConfirm = () => {
  setStep("pix");
};
```

Para:
```typescript
const handlePixConfirm = async () => {
  setStep("pix");
  // Registrar intenção de pagamento PIX (não bloqueia o fluxo)
  try {
    await createCharge({ ...basePayload, payment_method: "pix" });
  } catch {
    // Apenas logging, não impede o usuário de ver a chave
  }
};
```

Isso criará um registro na tabela `transactions` com `type: "pix"`, `status: "pendente"`, `source: "member-area"`, vinculado ao workspace e com os dados do cliente.

### Após deploy
```bash
cd ~/simplificandoconversas/deploy && bash update.sh
```

