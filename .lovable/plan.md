

# Plano: Corrigir título inconsistente de notificação de transações

## Diagnóstico
A query do `useUnseenTransactions` busca TODAS as transações com `viewed_at = null`, mas as 4 categorias de aba não cobrem todos os combos de `type`+`status`. Exemplo: `type="pix"` com `status="cancelado"` não entra em nenhuma aba, mas conta no total do título.

## Solução (2 partes)

### 1. Frontend — `src/hooks/useUnseenTransactions.ts`
Mudar o cálculo do título para somar apenas as 4 categorias conhecidas (que já é o que faz via `Object.values(counts)`). **Isso já está correto** — então o problema é no backend.

### 2. Backend — `deploy/backend/src/routes/platform-api.ts`
Adicionar endpoint `POST /mark-all-seen` que marca TODAS as transações com `viewed_at = null` como vistas:

```typescript
router.post("/mark-all-seen", async (req, res) => {
  const { workspaceId } = req.body;
  if (!workspaceId) return res.json({ updated: 0 });
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("transactions")
    .update({ viewed_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .is("viewed_at", null)
    .select("id");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ updated: data?.length || 0 });
});
```

### 3. Frontend — `src/hooks/useUnseenTransactions.ts`
Adicionar função `markAllSeen` que chama o novo endpoint.

### 4. Frontend — `src/components/transactions/TransactionsTable.tsx`
- No `useEffect` de initial load: chamar `markAllSeen()` ao invés de `markTabSeen(activeTab)`
- Manter `markTabSeen(activeTab)` apenas na troca de abas (para os dots individuais)
- Manter auto-mark de 2s para novas transações enquanto visualiza

Isso garante que ao abrir `/transacoes`, TODAS as transações ficam marcadas — eliminando órfãs que o título contava mas nenhuma aba cobria.

## Arquivos modificados
- `deploy/backend/src/routes/platform-api.ts` — novo endpoint `mark-all-seen`
- `src/hooks/useUnseenTransactions.ts` — nova função `markAllSeen`
- `src/components/transactions/TransactionsTable.tsx` — chamar `markAllSeen` no load inicial

## Após deploy
```bash
cd /root/simplificandoconversas/deploy && docker compose up -d --build backend
```

