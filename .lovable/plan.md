

## Expandir aba "Carrinhos" para incluir boletos com falha + mostrar erro correto

### Problema atual
1. A aba "Carrinhos" filtra apenas `type === "yampi_cart"` e `status === "abandonado"`, ignorando boletos que falharam
2. Quando o Mercado Pago rejeita um boleto (CPF inválido, etc.), o backend retorna erro HTTP sem salvar nada no banco — a transação simplesmente desaparece
3. Não há exibição do motivo do erro nas transações com falha

### Plano de correção

#### 1) Backend: salvar transações com falha no banco (`deploy/backend/src/routes/payment.ts`)
Quando o Mercado Pago retorna erro (ex: CPF inválido), em vez de apenas retornar o erro ao frontend, **também salvar a transação** no banco com:
- `status: "rejeitado"`
- `metadata.error_reason`: mensagem de erro do MP (ex: `"cc_rejected_bad_filled_card_number"`, `"2067 - invalid cpf"`)
- `metadata.mp_error`: detalhes completos do erro

Isso permitirá que boletos com falha apareçam na listagem.

#### 2) Frontend: renomear e expandir o filtro da aba "Carrinhos" (`src/components/transactions/TransactionsTable.tsx`)
Alterar o filtro `yampi-abandonados` para incluir:
- Transações `yampi_cart` com status `abandonado` (carrinho abandonado Yampi — mantém)
- Transações `boleto` com status `rejeitado` (boleto com falha de CPF, etc.)
- Transações com status `rejeitado` de qualquer tipo

O filtro ficará:
```typescript
"yampi-abandonados": transactions.filter(
  (t) => (t.type === "yampi_cart" && t.status === "abandonado") ||
         t.status === "rejeitado"
),
```

#### 3) Exibir o motivo do erro na tabela e no detalhe
- Na coluna de **Status** da aba Carrinhos, quando a transação tiver `metadata.error_reason` ou `metadata.mp_error`, exibir um tooltip com o motivo do erro
- No `TransactionDetailDialog.tsx`, adicionar uma seção de "Motivo do erro" que mostra `metadata.error_reason` ou `metadata.mp_status_detail` quando disponível

#### 4) Mapear mensagens de erro do MP para português
Criar um mapa de tradução dos erros comuns do Mercado Pago:
- `"2067"` / `"invalid_identification_number"` → "CPF inválido"
- `"cc_rejected_bad_filled_card_number"` → "Número do cartão inválido"
- `"cc_rejected_insufficient_amount"` → "Saldo insuficiente"
- Outros → mostrar a mensagem original

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/payment.ts` | Salvar transação com `status: "rejeitado"` quando MP retorna erro |
| `src/components/transactions/TransactionsTable.tsx` | Expandir filtro da aba Carrinhos para incluir transações rejeitadas; exibir tooltip de erro |
| `src/components/transactions/TransactionDetailDialog.tsx` | Mostrar motivo do erro quando disponível no metadata |

### Fluxo após a correção

```text
Usuário gera boleto com CPF inválido
  → MP retorna erro 400
  → Backend salva transação com status="rejeitado" + metadata.error_reason
  → Transação aparece na aba "Carrinhos" com badge "Rejeitado"
  → Tooltip/detalhe mostra "CPF inválido"
```

