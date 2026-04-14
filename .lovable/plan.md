

# Auto-sync Meta Ads ao abrir o Relatório

## Problema
Os dados de gastos Meta Ads só aparecem se o usuário sincronizar manualmente. O relatório já busca da tabela `meta_ad_spend`, mas ela fica vazia sem chamar a edge function `sync-meta-ads`.

## Solução
Adicionar um `useEffect` no `useMetaAdSpend` (ou no `FinancialReport`) que automaticamente chama a edge function `sync-meta-ads` quando o relatório é aberto, populando a tabela antes da query principal retornar os dados.

## Alterações

### 1. `src/hooks/useMetaAdSpend.ts`
- Adicionar uma mutation `syncMetaAds` que chama a edge function via fetch para o backend da VPS (`/functions/v1/sync-meta-ads`)
- Adicionar um `useEffect` que dispara o sync automaticamente quando `workspaceId` e as datas estiverem disponíveis
- Após o sync completar, invalidar a query `meta-ad-spend` para recarregar os dados frescos
- Adicionar controle para não sincronizar repetidamente (debounce com ref ou `staleTime`)

### 2. `src/components/transactions/FinancialReport.tsx`
- Exibir um indicador sutil (ex: texto "Sincronizando gastos Meta..." ou spinner pequeno) enquanto o sync está rodando
- Nenhuma mudança na lógica de cálculo — já está correto subtraindo `metaTotal` do líquido

## Detalhes técnicos
- O sync chamará `POST /functions/v1/sync-meta-ads` com `{ workspace_id, start_date, end_date }` formatados como `YYYY-MM-DD`
- Usará `useRef` para evitar chamadas duplicadas no mesmo ciclo de renderização
- O `refetchInterval` ou `staleTime` da query principal garantirá que os dados apareçam logo após o sync

