

## Plano: Corrigir registro de transação PIX no backend

### Causa raiz
O backend `member-purchase.ts` ainda tenta gerar uma cobrança real via OpenPix quando `payment_method === "pix"`. Se o OpenPix não estiver configurado, retorna erro 500 (`"OpenPix não configurado"`). O frontend captura esse erro no `catch` silencioso e segue sem registrar nada.

O fluxo PIX agora é manual (exibir chave), então o backend deve apenas registrar a intenção — exatamente como já faz para `cartao`.

### Alteração

**Arquivo: `deploy/backend/src/routes/member-purchase.ts`**

Substituir o bloco PIX inteiro (linhas 94-165, que chama OpenPix API) por um registro simples de intenção:

```typescript
if (payment_method === "pix") {
  const { data: tx } = await sb
    .from("transactions")
    .insert({
      user_id: creds.userId,
      workspace_id,
      type: "pix",
      status: "pendente",
      amount: Number(amount),
      customer_phone: normalizedPhone,
      customer_name: customer_name || null,
      customer_email: resolvedEmail,
      customer_document: customer_document || null,
      description,
      source: "member-area",
    })
    .select("id")
    .single();

  console.log(`[member-purchase] ✅ PIX intent logged: ${tx?.id}`);
  return res.json({ success: true, transaction_id: tx?.id, type: "pix" });
}
```

Isso elimina a dependência do OpenPix e garante que a transação seja criada sempre.

### Após deploy na VPS
```bash
cd ~/simplificandoconversas/deploy && bash update.sh
```

### Resultado esperado
- Ao confirmar PIX na Área de Membros, a transação aparece imediatamente na tabela `transactions` com `type: "pix"`, `status: "pendente"`, `source: "member-area"`

