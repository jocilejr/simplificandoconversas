

# Fix: Ordenação opera sobre todos os leads, não apenas a página atual

## Problema

A ordenação por coluna (Agendamentos, Total Pago, etc.) acontece em `Leads.tsx` sobre o array `leads`, que já é o resultado paginado (50 itens da página atual). Ao ordenar por "Total Pago" decrescente, por exemplo, só reordena os 50 leads daquela página — os leads com valores maiores em outras páginas não aparecem.

## Solução

Mover a lógica de ordenação para dentro do hook `useLeads.ts`, aplicando o sort **antes** da paginação. O `Leads.tsx` passa `sortField` e `sortDir` para o hook via setState.

### Arquivo: `src/hooks/useLeads.ts`

- Adicionar estados `sortField` e `sortDir` ao hook
- Criar um `sorted` useMemo entre `filtered` e a paginação:
  ```
  filtered → sorted (por sortField/sortDir) → paginated (slice)
  ```
- Expor `sortField`, `setSortField`, `sortDir`, `setSortDir` no retorno
- `paginated` passa a usar `sorted` em vez de `filtered`

### Arquivo: `src/pages/Leads.tsx`

- Remover os estados locais `sortField` e `sortDir`
- Remover o `useMemo` de `sortedLeads`
- Consumir `sortField`, `setSortField`, `sortDir`, `setSortDir` do hook
- Usar `leads` diretamente na tabela (já vem ordenado e paginado)
- Resetar `page` para 1 ao mudar a ordenação

