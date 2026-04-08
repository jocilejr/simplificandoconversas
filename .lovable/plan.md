

# Fix: Deduplicação de transações rejeitadas via API

## Problema
Quando a API retorna erro (ex: CPF inválido no Mercado Pago), o n8n re-envia a mesma requisição automaticamente. Cada tentativa salva uma nova transação "rejeitado" na tabela, causando duplicação (5 registros iguais na screenshot).

O código na linha 1158 faz `insert` incondicional — não verifica se já existe uma transação rejeitada idêntica.

## Solução

**Arquivo:** `deploy/backend/src/routes/platform-api.ts`

No bloco de erro do Mercado Pago (linha ~1157), antes de inserir a transação rejeitada, verificar se já existe uma transação idêntica recente (mesmo cliente, valor, tipo, status rejeitado, nos últimos 5 minutos). Se existir, pular o insert.

```typescript
// Antes de inserir transação rejeitada, checar duplicata recente
const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
const { data: existing } = await sb
  .from("transactions")
  .select("id")
  .eq("workspace_id", workspaceId)
  .eq("customer_phone", customer_phone || "")
  .eq("amount", Number(amount))
  .eq("type", paymentType)
  .eq("status", "rejeitado")
  .gte("created_at", fiveMinAgo)
  .limit(1)
  .maybeSingle();

if (!existing) {
  await sb.from("transactions").insert({
    // ... campos existentes
  });
}
```

Isso impede que retries automáticos do n8n criem múltiplas transações rejeitadas idênticas, sem alterar o fluxo normal.

