

# Modal de detalhes da transação com download de PDF

## Resumo
Ao clicar em uma linha da tabela de transações, abre um Dialog mostrando todas as informações do cliente (nome, CPF, telefone, email) + detalhes da transação. Inclui botão para baixar PDF do boleto (abre o `payment_url` em nova aba, que é o link do Mercado Pago com opção de download).

## Alterações

### 1. `src/components/transactions/TransactionDetailDialog.tsx` (novo)
- Componente Dialog que recebe uma `Transaction | null` e `open/onClose`
- Exibe:
  - Tipo + Status (badges)
  - Nome completo
  - CPF (customer_document)
  - Telefone
  - Email (se existir, senão mostra "Não informado")
  - Valor formatado
  - Data de criação
  - Descrição (se existir)
- Botão "Baixar PDF" visível quando `payment_url` existe — abre o link do Mercado Pago em nova aba (o MP já fornece o PDF do boleto nesse link)
- Botão "Copiar Link" para copiar o `payment_url`

### 2. `src/components/transactions/TransactionsTable.tsx`
- Adicionar estado `selectedTx` para a transação selecionada
- Tornar cada `TableRow` clicável (`onClick` + `cursor-pointer`)
- Renderizar o `TransactionDetailDialog` no final do componente

## Resultado
Ao clicar em qualquer linha da tabela, o modal abre com os dados completos. O botão "Baixar PDF" redireciona para o link do Mercado Pago onde o PDF do boleto está disponível.

