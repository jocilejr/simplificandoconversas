

# Plano: Indicador individual de sync por grupo

## Contexto
O auto-sync **está funcionando** — o log mostra "2 link(s) processed". O que falta é gravar e exibir o status individual de cada grupo.

## Alterações

### 1. Backend — `deploy/backend/src/routes/groups-api.ts`

No `sync-invite` (manual) e `sync-all` (automático), após processar cada grupo no loop, gravar dentro do objeto `gl`:

```js
gl.last_synced_at = new Date().toISOString();
gl.last_sync_status = inviteFetched ? (gl.status === "banned" ? "banned" : "ok") : "error";
```

Esses campos ficam no JSONB `group_links` — sem migration.

### 2. Frontend — `src/hooks/useGroupSmartLinks.ts`

Adicionar ao tipo `GroupLink`:
- `last_synced_at?: string`
- `last_sync_status?: "ok" | "banned" | "error"`
- `status?: string`

### 3. Frontend — `src/components/grupos/GroupSmartLinkTab.tsx`

Na tabela, adicionar uma coluna **"Último Sync"** com:
- Tempo relativo ("há 5s", "há 3min") usando `formatTimeAgo`
- Cor baseada no `last_sync_status`:
  - Verde: ok
  - Vermelho: banned/error  
  - Cinza: nunca sincronizado
- Tooltip com detalhes quando hover

### Nenhuma migration necessária
Todos os dados ficam no JSONB existente `group_links`.

### Deploy
```bash
cd /root/simplificandoconversas/deploy && docker compose up -d --build backend
```

