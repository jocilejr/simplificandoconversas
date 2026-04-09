

# Fix: Dot persiste porque mark-seen só marca transações do filtro de data atual

## Problema

O `useUnseenTransactions` conta TODAS as transações com `viewed_at = NULL` (sem filtro de data). Mas o `markTabAsSeen` só marca as transações visíveis na lista atual (filtrada por data). Transações de dias anteriores nunca são marcadas, e o dot nunca desaparece.

## Solução

Criar um endpoint backend `POST /mark-tab-seen` que recebe `workspaceId` + `tab` e marca TODAS as transações daquela categoria com `viewed_at = NULL`, sem filtro de data. Cada aba marca independentemente ao ser selecionada.

## Alterações

### 1. Backend: `deploy/backend/src/routes/platform-api.ts`

Novo endpoint `POST /mark-tab-seen`:

```typescript
router.post("/mark-tab-seen", async (req, res) => {
  const { workspaceId, tab } = req.body;
  if (!workspaceId || !tab) return res.json({ updated: 0 });

  const sb = getServiceClient();
  let query = sb
    .from("transactions")
    .update({ viewed_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .is("viewed_at", null);

  // Filtrar pela mesma lógica de categorização das abas
  switch (tab) {
    case "aprovados":
      query = query.eq("status", "aprovado");
      break;
    case "boletos-gerados":
      query = query.eq("type", "boleto").eq("status", "pendente");
      break;
    case "pix-cartao-pendentes":
      query = query.in("type", ["pix", "cartao", "card"]).eq("status", "pendente");
      break;
    case "rejeitados":
      // rejeitados = status rejeitado OR (yampi_cart + abandonado)
      // Supabase doesn't support OR in update easily, so two updates
      break;
  }

  // Para "rejeitados" precisa de tratamento especial (OR condition)
  // Executar update e retornar
});
```

O caso `rejeitados` requer 2 updates separados (status=rejeitado e type=yampi_cart+status=abandonado).

### 2. Frontend: `src/hooks/useUnseenTransactions.ts`

Substituir `markSeen(ids)` por `markTabSeen(tab)`:

```typescript
const markTabSeen = useCallback(async (tab: TabKey) => {
  if (!workspaceId) return;
  await fetch(apiUrl("mark-tab-seen"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId, tab }),
  });
  queryClient.invalidateQueries({ queryKey: ["unseen-transactions"] });
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
}, [workspaceId, queryClient]);
```

### 3. Frontend: `src/components/transactions/TransactionsTable.tsx`

Simplificar `markTabAsSeen` para chamar `markTabSeen(tab)` diretamente (sem filtrar IDs localmente):

```typescript
const markTabAsSeen = useCallback((tab: TabKey) => {
  if (hasUnseen(tab)) {
    markTabSeen(tab);
  }
}, [hasUnseen, markTabSeen]);
```

Manter os dois `useEffect` existentes (tab change + initial load) que chamam `markTabAsSeen`.

### 4. Manter endpoint `mark-seen` antigo

Não remover -- pode ser usado em outros lugares. Apenas adicionar o novo `mark-tab-seen`.

## Resumo do fluxo

1. Usuário abre `/transacoes` -- aba default "aprovados" ativa
2. `useEffect` chama `markTabSeen("aprovados")` -- backend marca TODAS com status=aprovado e viewed_at=NULL
3. Dot some apenas de "aprovados"
4. Usuário clica aba "boletos-gerados" -- `markTabSeen("boletos-gerados")` marca todas dessa categoria
5. Dot some de "boletos-gerados"
6. Nova transação chega -- viewed_at=NULL -- dot reaparece na aba correspondente

