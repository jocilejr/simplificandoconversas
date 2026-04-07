

## Redesign da Página de Transações

### Problema Atual
- 4 stat cards com categorias confusas (Total, Aprovados, Boletos, PIX/Cartão Pendente)
- Abas na tabela redundantes com os cards
- Informações irrelevantes e layout pouco profissional

### Nova Estrutura

**3 Stat Cards (resumo limpo):**
1. **Total Geral** - soma de todas as transações + quantidade
2. **Pagos** - status "aprovado" (verde)
3. **Pendentes** - status "pendente" (amarelo)

**3 Abas na tabela:**
1. **Todos** - todas as transações
2. **Pagos** - apenas aprovados
3. **Pendentes** - apenas pendentes, com sub-filtro dropdown: "Todos pendentes", "Boleto (não pago)", "PIX pendente", "Cartão pendente"

**Melhorias na tabela:**
- Remover coluna CPF (irrelevante na listagem, já aparece no detalhe)
- Coluna de valor mais destacada
- Status com badges mais profissionais
- Layout mais limpo e espaçado

### Arquivos Modificados

1. **`src/pages/Transacoes.tsx`** - Reduzir de 4 para 3 stat cards (Total, Pagos, Pendentes), atualizar stats usados
2. **`src/hooks/useTransactions.ts`** - Simplificar stats para: total, paid (aprovado), pending (pendente) com amounts
3. **`src/components/transactions/TransactionsTable.tsx`** - Redesenhar abas (Todos/Pagos/Pendentes), adicionar dropdown de sub-filtro na aba Pendentes (Boleto/PIX/Cartão), remover coluna CPF da listagem, melhorar espaçamento e visual
4. **`src/components/transactions/StatCard.tsx`** - Manter sem alterações (componente já está limpo)

### Detalhes Técnicos

- Sub-filtro de pendentes: `Select` dropdown que aparece ao lado das abas quando "Pendentes" está selecionado
- Filtros: Boleto = `type === "boleto" && status === "pendente"`, PIX = `type === "pix" && status === "pendente"`, Cartão = `type === "cartao" || type === "card" && status === "pendente"`
- Stats simplificados no hook: `paidCount`, `paidAmount`, `pendingCount`, `pendingAmount`

