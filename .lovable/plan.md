

## Reorganização da Visão Geral de Grupos

### Nova ordem da aba (cima → baixo)
1. **SchedulerDebugPanel** (programação do dia) — já existe, fica no topo
2. **Card de Informações Gerais** (stats + filtro de período) — Grupos Monitorados, Total Membros, Campanhas Ativas, Enviadas Hoje, Entraram, Saíram + filtro Hoje/Ontem/Personalizado + botão "Ver eventos em tempo real"
3. **Card "Grupos Monitorados"** — lista com nome do grupo, total de membros, +entraram/−saíram do período selecionado

Remove a versão atual onde o botão de eventos vive dentro do card de grupos. Substitui por um botão único no card de stats.

### Modal de eventos em tempo real
Novo modal acionado pelo botão "Ver eventos em tempo real":
- Lista cronológica reversa (mais recente primeiro): "há X min · {participant} entrou em {grupo}" / "saiu de"
- Tempo relativo via `formatDistanceToNow` do `date-fns/locale/ptBR`
- Filtra pelo mesmo período selecionado no card de stats (Hoje/Ontem/custom em BRT)
- Refetch a cada 15s (real-time leve)
- Sem agregação — eventos crus

### Estratégia de fetch (resolve o pedido de "fetch a cada 1h")

**Dados pesados (membros, contagens):** `useGroupSelected` + `syncStats` → `staleTime: 1h`, `refetchInterval: 1h`. Sem polling agressivo.

**Eventos add/remove (dinâmico):** `useGroupEvents` (agregado por grupo) → `refetchInterval: 30s`. Mantém o "+entraram/−saíram do dia" sempre fresco.

**Membros dinâmicos:** Frontend calcula `totalMembros = base_member_count + adds_hoje − removes_hoje` no card "Total de Membros", para refletir variação em tempo real entre os fetchs horários. A cada 1h o `syncStats` re-baseia o número real do Evolution.

**Modal real-time:** Hook novo `useGroupEventsLive(period)` → busca eventos crus com `refetchInterval: 15s` enquanto o modal está aberto.

### Backend — endpoint adicional

Adicionar em `groups-api.ts`:
```
GET /api/groups/events-live?workspaceId&period&from&to&limit=200
```
SQL bruto via `pg.Pool`:
```sql
SELECT e.id, e.group_jid, e.group_name, e.participant_jid,
       e.action, e.occurred_at
FROM group_events e
JOIN group_selected s
  ON s.workspace_id=e.workspace_id
 AND s.instance_name=e.instance_name
 AND s.group_jid=e.group_jid
WHERE e.workspace_id=$1
  AND e.occurred_at >= $2 AND e.occurred_at < $3
ORDER BY e.occurred_at DESC
LIMIT $4;
```
Retorna `{ events: [{ id, group_jid, group_name, participant_jid, action, occurred_at }] }`.

O endpoint `/events` (agregado) continua existindo e alimenta os cards + lista de grupos.

### Frontend — arquivos alterados

- **`src/components/grupos/GroupDashboardTab.tsx`** — reordenar: SchedulerDebugPanel → Card Info+Filtro → Card Grupos. Remover botão de eventos do card de grupos. Adicionar botão "Ver eventos em tempo real" no card de stats. Adicionar cálculo dinâmico `member_count + adds − removes`.
- **`src/hooks/useGroupSelected.ts`** — trocar `refetchInterval: 15000` por `staleTime: 3600000, refetchInterval: 3600000`.
- **`src/hooks/useGroupEvents.ts`** — manter (já agrega), apenas confirmar `refetchInterval: 30000`.
- **`src/hooks/useGroupEventsLive.ts`** — novo. 1 fetch para `/events-live`, retorna lista crua. `refetchInterval: 15000`, `enabled: open`.
- **Modal novo** dentro de `GroupDashboardTab.tsx` — lista vertical com `formatDistanceToNow(occurred_at, { locale: ptBR, addSuffix: true })` + ícone +/− por linha.

### Backend — arquivos alterados
- **`deploy/backend/src/routes/groups-api.ts`** — adicionar handler `GET /events-live` com a SQL acima.

### Banco
Nenhuma migração. A tabela `group_events` já tem tudo (`participant_jid`, `occurred_at`, `action`, `group_name`).

### Execução
1. Lovable aplica as mudanças (frontend + backend).
2. Você roda na VPS:
   ```
   cd ~/simplificandoconversas && git pull && bash deploy/update.sh
   ```
3. Validar: abrir `/grupos`, ver nova ordem; abrir modal e ver eventos em tempo real com timestamps relativos.

