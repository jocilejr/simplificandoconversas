

# Vincular transação PIX existente ao contato

## Problema atual
Ao selecionar PIX na entrega digital, o sistema **cria uma nova transação**. O correto é **buscar transações PIX aprovadas sem telefone** (órfãs vindas do webhook, que já têm `customer_name` e `customer_document` mas não têm `customer_phone`) e permitir vincular ao contato buscado pelo telefone.

## Novo fluxo

```text
Telefone → Pagamento → [PIX] Selecionar Transação Órfã → Resultado
```

## Mudanças em `src/components/entrega/DeliveryFlowDialog.tsx`

### A) Novo step e estados
- Adicionar `"select-tx"` ao type `Step`
- Novos estados: `orphanTxs` (lista de transações encontradas) e `selectedTxId`

### B) Ao clicar em PIX
Em vez de chamar `processDelivery("pix")`, buscar transações órfãs:
```typescript
// Buscar PIX aprovados SEM telefone no workspace
const { data } = await supabase
  .from("transactions")
  .select("*")
  .eq("workspace_id", workspaceId)
  .eq("type", "pix")
  .eq("status", "aprovado")
  .is("customer_phone", null)
  .order("created_at", { ascending: false });
```
- Se encontrou → mostrar step `"select-tx"` com a lista
- Se não encontrou → toast "Nenhuma transação PIX sem vínculo encontrada"

### C) Nova tela `select-tx`
Lista de cards clicáveis mostrando:
- Valor (`R$ X,XX`)
- Nome do cliente (vindo do webhook)
- CPF (vindo do webhook)
- Data de pagamento
- ID parcial

Ao clicar, chama `processDelivery("pix", txId)`.

### D) Alterar `processDelivery` para PIX
Receber `existingTxId?: string`. Quando PIX + existingTxId:
- **UPDATE** a transação existente adicionando `customer_phone` do contato buscado
- **Não criar** transação nova
- O `customer_name` e `customer_document` já existem (vieram do webhook)
- Adicionar `description: product.name` e `source: "entrega_digital"` ao update

```typescript
if (method === "pix" && existingTxId) {
  await supabase
    .from("transactions")
    .update({
      customer_phone: normalized,
      description: product.name,
    })
    .eq("id", existingTxId);
}
```

### E) Enriquecer LeadInfo com dados da transação selecionada
Ao vincular, preencher o `leadInfo` com `customer_name` e `customer_document` da transação selecionada — integrando CPF da transação ao contato.

## Arquivo alterado
- `src/components/entrega/DeliveryFlowDialog.tsx`

## Resultado
Transação PIX de "CPF X" fica vinculada ao "Contato Y" (identificado pelo telefone). Nenhuma transação duplicada é criada.

