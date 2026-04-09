

# Fix: markSeen não funciona — solução simples via backend

## Problema

O `markSeen` atual faz `supabase.from("transactions").update(...)` direto pelo client JS do frontend. Na VPS, o PostgREST provavelmente rejeita esse update silenciosamente (RLS ou cast do `as any`), então `viewed_at` nunca é gravado.

## Solução

Criar um endpoint `POST /mark-seen` no backend (que usa service role, sem RLS) e fazer o frontend chamar esse endpoint.

## Alterações

### 1. Backend — `deploy/backend/src/routes/platform-api.ts`

Adicionar rota simples no final do router:

```typescript
router.post("/mark-seen", async (req, res) => {
  const { ids, workspaceId } = req.body;
  if (!ids?.length || !workspaceId) return res.json({ updated: 0 });

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("transactions")
    .update({ viewed_at: new Date().toISOString() })
    .in("id", ids)
    .eq("workspace_id", workspaceId)
    .is("viewed_at", null)
    .select("id");

  if (error) return res.status(500).json({ error: error.message });
  res.json({ updated: data?.length || 0 });
});
```

### 2. Frontend — `src/hooks/useUnseenTransactions.ts`

Substituir o `markSeen` para chamar o backend via `apiUrl("mark-seen")` com fetch, passando `ids` e `workspaceId`. Após sucesso, invalidar `["unseen-transactions"]` e `["transactions"]`. Adicionar `console.error` se falhar para facilitar debug futuro.

### 3. Frontend — `src/components/transactions/TransactionsTable.tsx`

Manter a lógica atual do `useEffect` com `prevTab` (que já funciona corretamente para detectar a aba). O problema não era a detecção — era o `markSeen` que não gravava. Com o backend funcionando, a lógica atual resolve.

Adicionar também: quando `isLoading` muda de `true` para `false`, resetar `prevTab` para `null` para forçar re-processamento da aba ativa com os dados reais.

### 4. Deploy

```bash
docker compose up -d --build backend
```

