

# Indicador de Transações Não Visualizadas (Database-native)

## Abordagem

Usar um campo `viewed_at` na própria tabela `transactions` para rastrear se cada transação foi visualizada. Quando `viewed_at IS NULL`, a transação é considerada "não vista" e o dot verde aparece.

## Alterações

### 1. Migration: adicionar coluna `viewed_at` na tabela `transactions`

```sql
ALTER TABLE public.transactions ADD COLUMN viewed_at timestamptz DEFAULT NULL;
-- Marcar todas as existentes como já vistas
UPDATE public.transactions SET viewed_at = now() WHERE viewed_at IS NULL;
```

### 2. Criar `src/hooks/useUnseenTransactions.ts`

- Query leve que busca contagem de transações com `viewed_at IS NULL` por categoria (boleto pendente, pix/cartao pendente, aprovados, rejeitados) para o workspace ativo
- Retorna `hasUnseen(tab)` e `hasAnyUnseen()`
- Função `markSeen(transactionIds[])` que faz `UPDATE transactions SET viewed_at = now() WHERE id IN (...)`
- Usar realtime subscription para invalidar a query quando novas transações chegam

### 3. Modificar `src/components/transactions/TransactionsTable.tsx`

- Importar `useUnseenTransactions`
- Adicionar dot verde pulsante (`w-2 h-2 bg-green-500 rounded-full animate-pulse`) em cada `TabsTrigger` que tiver transações não vistas
- Quando o usuário troca de aba, chamar `markSeen()` para todas as transações visíveis naquela aba
- Quando o componente monta na aba ativa, marcar como vistas também

### 4. Modificar `src/components/AppSidebar.tsx`

- Importar `useUnseenTransactions`
- No item "Transações" do menu, renderizar o dot verde pulsante ao lado do texto quando `hasAnyUnseen()` retornar true

## Detalhes Técnicos

- A coluna `viewed_at` é nullable; `NULL` = não vista
- O update é feito via Supabase client direto (já tem RLS com `can_write_workspace`)
- A query de contagem na sidebar é leve: `SELECT count(*) ... WHERE viewed_at IS NULL AND workspace_id = ?`
- O dot desaparece imediatamente ao abrir a aba correspondente
- Novas transações entram com `viewed_at = NULL` automaticamente (default da coluna)

