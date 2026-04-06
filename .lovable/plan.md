

# Email automático na geração de boleto

## Resumo
Remover a obrigatoriedade do campo email no formulário. O backend buscará o email vinculado ao telefone na tabela `conversations`. Se não encontrar, usará o email fixo `businessvivaorigem@gmail.com`.

## Alterações

### 1. Frontend: `src/pages/GerarBoleto.tsx`
- Remover o campo de email do formulário (ou torná-lo oculto/opcional sem destaque)
- Não enviar `customer_email` no payload — o backend resolve sozinho

### 2. Backend: `deploy/backend/src/routes/payment.ts`
- Após receber o request, se `customer_email` estiver vazio e `customer_phone` estiver preenchido:
  1. Buscar na tabela `conversations` um registro onde `phone_number` = telefone informado e `email` não é nulo
  2. Se encontrar, usar esse email
  3. Se não encontrar, usar `businessvivaorigem@gmail.com`
- Lógica (antes de montar o `paymentBody`):
```ts
let resolvedEmail = customer_email;
if (!resolvedEmail && customer_phone) {
  const phone = customer_phone.replace(/\D/g, "");
  const { data: conv } = await supabase
    .from("conversations")
    .select("email")
    .eq("user_id", userId)
    .eq("phone_number", phone)
    .not("email", "is", null)
    .limit(1)
    .single();
  resolvedEmail = conv?.email || "businessvivaorigem@gmail.com";
}
if (!resolvedEmail) resolvedEmail = "businessvivaorigem@gmail.com";
```
- Usar `resolvedEmail` no `payer.email` do `paymentBody`

### 3. Hook: `src/hooks/useCreatePayment.ts`
- Tornar `customer_email` totalmente opcional (já é, sem alteração necessária)

## Resultado
O formulário não exigirá email. O backend buscará automaticamente o email pelo telefone no banco e, se não encontrar, usará o email fixo.

