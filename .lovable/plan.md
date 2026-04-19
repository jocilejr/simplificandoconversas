

## Diagnóstico

Preciso entender como a contagem de membros dos grupos é obtida e exibida. Vou explorar:

1. `deploy/backend/src/routes/groups-api.ts` — endpoints de listagem/sync de grupos
2. `deploy/backend/src/lib/group-scheduler.ts` — possível lógica de update
3. `src/components/grupos/GroupCampaignDialog.tsx` — onde os grupos são listados/selecionados
4. `src/hooks/useGroupSmartLinks.ts` — sync de invite e member_count
5. Tabelas no banco: `group_smart_links.group_links` (jsonb) — onde `member_count` é persistido
