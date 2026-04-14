

## Problema

Dois bugs impedem que arquivos importados apareçam como "Grupos" no Media Manager:

### Bug 1 — Nome do campo incompatível no remap (principal)
O frontend envia `urlRemapMap` mas o backend espera `mediaUrlMap`. Resultado: o remap nunca acontece, as mensagens no banco continuam com as URLs antigas do Supabase, e o Media Manager não consegue associar os novos arquivos (UUID) às mensagens.

- **Frontend** (`GroupImportDialog.tsx` linha 209): `urlRemapMap`
- **Backend** (`groups-api.ts` linha 1495): `mediaUrlMap`

### Bug 2 — Filtro sem workspace_id
A query de `group_scheduled_messages` no Media Manager (linha 165) filtra por `is_active = true` mas não filtra por `workspace_id`.

---

## Correções

### 1. `deploy/backend/src/routes/groups-api.ts` (linha 1495)
Aceitar ambos os nomes para compatibilidade:
```typescript
const { workspaceId, messageIds, mediaUrlMap, urlRemapMap } = req.body;
const remapEntries = mediaUrlMap || urlRemapMap;
if (!workspaceId || !messageIds || !remapEntries) {
  return res.status(400).json({ error: "Missing fields" });
}
```
E usar `remapEntries` no loop (linha 1515).

### 2. `deploy/backend/src/routes/media-manager.ts` (linha 165)
Adicionar filtro de workspace:
```typescript
const { data: gsm } = await sb
  .from("group_scheduled_messages")
  .select("content")
  .eq("workspace_id", workspaceId)
  .eq("is_active", true);
```

### Resultado
- O remap funciona corretamente, atualizando as URLs nas mensagens
- Próximas importações terão os arquivos classificados como "Grupos"
- Para importações passadas: basta re-importar o backup, ou o usuário pode verificar na VPS com os comandos que eu forneço

