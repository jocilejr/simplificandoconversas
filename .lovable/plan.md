

# Correção: Webhook de boleto aprovado + validação de pendente

## Regra

**Evento approved**:
1. Buscar no banco por `external_id`
2. Se existir → atualizar status para `"aprovado"`, preencher `paid_at`, remover da `recovery_queue`
3. Se NÃO existir → criar transação com `status = "aprovado"` e `paid_at`, mesmo sem dados completos (aparece na aba "Aprovados")

**Evento pending (criação de novo)**:
1. Só criar se tiver os 5 campos obrigatórios (barcode, CPF, nome, telefone, PDF URL)
2. Se faltar algum → ignorar (return 200)

## Alteração em `deploy/backend/src/routes/payment.ts`

### Step 4 (linhas 640-738) — Bloco de criação de nova transação

Substituir a lógica atual por:

```text
Se mpData.status === "approved":
  → Criar transação com status "aprovado" + paid_at
  → Sem exigir 5 campos (pagamento já feito, dados que tiver salva)
  → NÃO enfileirar recovery

Se mpData.status === "pending":
  → Validar 5 campos:
    - barcode (barcode.content OU digitable_line)
    - CPF (payer.identification.number)
    - Nome (payer.first_name)
    - Telefone (payer.phone.number)
    - PDF URL (external_resource_url OU ticket_url)
  → Se faltar qualquer um → log + return 200
  → Se tiver todos → criar + enfileirar recovery

Qualquer outro status → ignorar
```

A lógica do Step 3 (transação já existe, linhas 604-638) já funciona corretamente — atualiza status e remove da recovery_queue quando approved.

### Código concreto no Step 4

```typescript
// Step 4: Create new transaction
if (mpData.status === "approved") {
  // Boleto pago — criar registro direto como aprovado
  await supabase.from("transactions").insert({
    user_id: userId,
    workspace_id: workspaceId,
    amount: mpData.transaction_amount || 0,
    type: resolveTransactionType(mpData.payment_method_id),
    status: "aprovado",
    source: "mercadopago",
    external_id: String(mpData.id),
    customer_name: mpData.payer?.first_name
      ? `${mpData.payer.first_name} ${mpData.payer.last_name || ""}`.trim()
      : null,
    customer_email: mpData.payer?.email || null,
    customer_phone: cleanPhone,
    customer_document: mpData.payer?.identification?.number || null,
    description: mpData.description || null,
    payment_url: paymentUrl,
    metadata: { ...metadataObj, created_by_webhook: true },
    paid_at: mpData.date_approved || new Date().toISOString(),
  });
  return res.sendStatus(200);
}

if (mpData.status !== "pending") {
  console.log(`[boleto-webhook] Ignoring status ${mpData.status}`);
  return res.sendStatus(200);
}

// Status pending — exigir 5 campos obrigatórios
const hasBarcode = !!(mpData.barcode?.content || mpData.transaction_details?.digitable_line);
const hasCpf = !!mpData.payer?.identification?.number;
const hasName = !!mpData.payer?.first_name;
const hasPhone = !!(mpData.payer?.phone?.number);
const hasPdf = !!(mpData.transaction_details?.external_resource_url ||
                   mpData.point_of_interaction?.transaction_data?.ticket_url);

if (!hasBarcode || !hasCpf || !hasName || !hasPhone || !hasPdf) {
  console.log(`[boleto-webhook] Skipping pending — missing: barcode=${hasBarcode} cpf=${hasCpf} name=${hasName} phone=${hasPhone} pdf=${hasPdf}`);
  return res.sendStatus(200);
}

// Criar transação pendente + enfileirar recovery (código existente)
```

## Resultado

```text
Webhook approved + existe no banco → atualiza para "aprovado" (já funciona)
Webhook approved + NÃO existe → cria como "aprovado" (aparece em Aprovados)
Webhook pending + 5 campos OK → cria como "pendente" (aparece no Follow Up)
Webhook pending + falta campo → ignora
Webhook outro status → ignora
```

