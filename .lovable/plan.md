

## Refatoração: monitoramento via Smart Links (sem botão manual)

### Conceito

Eliminar a aba **"Selecionar"** e a tabela `group_selected`. O monitoramento opera 100% sobre Smart Links existentes — escolhe um Smart Link no header e vê os grupos daquele link, com totais e eventos add/remove.

Sem botão "Atualizar agora". Tudo depende do sync periódico do Smart Link que já roda (`/smart-links/sync-all`, comprovadamente correto).

### Frontend

**`src/pages/GruposPage.tsx`**
- Remove TabsTrigger/Content "Selecionar".
- Tabs finais: Visão Geral · Campanhas · Fila · Smart Link.

**`src/components/grupos/GroupDashboardTab.tsx`** (reescrita)
- Header com `<Select>` "Smart Link a monitorar" populado por `useGroupSmartLinks()`. Persiste em `localStorage` (`grupos:dashboard:smartLinkId`).
- Estado vazio: "Crie um Smart Link na aba Smart Link para começar a monitorar."
- KPIs do Smart Link selecionado:
  - Total de grupos · Total de membros (soma de `group_links[*].member_count`)
  - Entraram hoje · Saíram hoje (de `group_events` filtrado pelos `group_jid` do link)
- Lista de grupos do Smart Link: nome, contagem real, status (`ok` / `banned` / `error`), `last_synced_at`.
- Feed live de add/remove via `useGroupEventsLive`, filtrado pelos `group_jid` do Smart Link.
- Sem botão de refresh. Dados se atualizam pelo `refetchInterval` do `useGroupSmartLinks` (15s) e pelo cron de sync do backend.

**Arquivos a deletar:**
- `src/components/grupos/GroupSelectorTab.tsx`
- `src/hooks/useGroupSelected.ts`

### Backend

**`deploy/backend/src/routes/groups-api.ts`**
- Remover: `POST /select-groups`, `GET /selected-groups`, `DELETE /selected-groups/:id`, `POST /sync-stats`, função `syncWorkspaceStats`, cron `sync-all` antigo de `group_selected`.
- Manter: `POST /fetch-groups` (usado pela criação de Smart Link), todo o módulo `/smart-links/*` intacto.
- Adicionar: `GET /smart-link-events?smartLinkId=...` que retorna eventos de `group_events` filtrados pelos JIDs do Smart Link.

### Banco

```sql
DROP TABLE IF EXISTS public.group_selected CASCADE;
NOTIFY pgrst, 'reload schema';
```

### Validação na VPS

```bash
cd ~/simplificandoconversas && git pull && bash deploy/update.sh

source deploy/.env
docker exec deploy-postgres-1 psql -U postgres -d postgres -c \
  "SELECT slug, jsonb_array_length(group_links) AS grupos,
          (SELECT SUM((g->>'member_count')::int) FROM jsonb_array_elements(group_links) g) AS total_membros
   FROM group_smart_links WHERE workspace_id='65698ec3-731a-436e-84cf-8997e4ed9b41';"
```

### Arquivos alterados

- `deploy/backend/src/routes/groups-api.ts` — remoções + nova rota `/smart-link-events`
- `src/pages/GruposPage.tsx` — remove aba Selecionar
- `src/components/grupos/GroupDashboardTab.tsx` — reescrita orientada a Smart Link
- `src/components/grupos/GroupSelectorTab.tsx` — deletar
- `src/hooks/useGroupSelected.ts` — deletar
- Migration: `DROP TABLE group_selected`

### Risco

Médio — remove tabela e rotas. Mitigado: Smart Link já é a fonte oficial das contagens.

