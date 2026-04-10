

## Corrigir IA no Card de Saudação — Filtrar por workspace_id

### Problema
Dois bugs impedem a saudação da IA de aparecer:

1. **Backend `/ai-context` e `/offer-pitch` não recebem `workspace_id`** — as queries em `openai_settings` e `member_area_settings` fazem `.limit(1).maybeSingle()` SEM filtrar por `workspace_id`. Como a tabela `openai_settings` tem coluna `workspace_id`, a query pode retornar vazio se não filtrar corretamente.

2. **O GET `/:phone` não retorna `workspace_id` ao frontend** — o frontend não tem como enviar o workspace_id nas chamadas POST subsequentes.

### Correções

**1. `deploy/backend/src/routes/member-access.ts` — GET `/:phone`**
- Incluir `workspace_id` na resposta JSON:
```typescript
return res.json({
  phone: normalized,
  workspace_id: workspaceId,  // ← ADICIONAR
  settings, products, offers, customer
});
```

**2. `deploy/backend/src/routes/member-access.ts` — POST `/ai-context`**
- Receber `workspaceId` do body
- Filtrar `openai_settings` e `member_area_settings` por `workspace_id`:
```typescript
const { firstName, products, ..., workspaceId } = req.body;
// ...
sb.from("openai_settings").select("api_key").eq("workspace_id", workspaceId).maybeSingle()
sb.from("member_area_settings").select("ai_persona_prompt").eq("workspace_id", workspaceId).maybeSingle()
```

**3. `deploy/backend/src/routes/member-access.ts` — POST `/offer-pitch`**
- Mesmo ajuste: receber `workspaceId` e filtrar todas as queries por ele

**4. `src/pages/MemberAccess.tsx` — Frontend**
- Armazenar `workspace_id` do response do backend:
```typescript
const [workspaceId, setWorkspaceId] = useState<string | null>(null);
// na loadMemberData:
setWorkspaceId(payload.workspace_id);
```
- Passar `workspaceId` para `loadAiContext` e incluir no body do fetch `/ai-context`
- Passar `workspaceId` como prop ao `LockedOfferCard`

**5. `src/components/membros/LockedOfferCard.tsx`**
- Receber `workspaceId` como prop e incluir no body do fetch `/offer-pitch`

