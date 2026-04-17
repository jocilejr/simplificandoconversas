

## Correção

Trocar nos 2 pontos para **única fonte**: `participants.length`. Se ausente → `0` e log de aviso (não esconder com `size`).

### `deploy/backend/src/routes/groups-api.ts`

**a) `syncWorkspaceStats` (~linha 2570):**
```ts
const realCount = Array.isArray(info?.participants) ? info.participants.length : 0;
if (realCount === 0) {
  console.warn(`[sync-stats] no participants returned for ${group.group_jid} — skipping update`);
  continue;
}
```

**b) `/fetch-groups` (~linha 56):**
```ts
const memberCount = Array.isArray(group.participants) ? group.participants.length : 0;
```

Sem fallback para `size`. Sem cache. Verdade vem só do array `participants`.

### Deploy

```bash
cd ~/simplificandoconversas && git pull && bash deploy/update.sh

source deploy/.env
WS=65698ec3-731a-436e-84cf-8997e4ed9b41
curl -s -X POST "${API_URL}/api/groups/sync-stats" \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\":\"${WS}\"}" | jq '.results[] | {group_name, old_count, new_count}'
```

## Arquivo alterado

- `deploy/backend/src/routes/groups-api.ts` — 2 ajustes pontuais, sem fallback

## Risco

Zero.

