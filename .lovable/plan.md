

# Reorganizar abas de Transações

## Alteração em `src/components/transactions/TransactionsTable.tsx`

Substituir as abas atuais (Todos / Aprovados / Pendentes / Rejeitados) por:

1. **Todos** — todas as transações
2. **Boletos** — filtra por `type === "boleto"` (qualquer status)
3. **PIX/Cartão Pendente** — filtra por `type !== "boleto"` E `status === "pendente"`
4. **Aprovados** — filtra por `status === "aprovado"` (qualquer tipo)

Cada aba mostra a contagem entre parênteses, igual ao formato atual.

## Alteração em `src/pages/Transacoes.tsx`

Atualizar os StatCards para manter coerência com as novas categorias:
- **Total** (sem mudança)
- **Aprovados** (sem mudança)
- **Boletos** — total de boletos e valor
- **PIX/Cartão Pendente** — contagem e valor

## Arquivos modificados
- `src/components/transactions/TransactionsTable.tsx` — trocar filtros das tabs
- `src/pages/Transacoes.tsx` — ajustar StatCards
- `src/hooks/useTransactions.ts` — ajustar stats para incluir boletos e pix/cartão pendente

