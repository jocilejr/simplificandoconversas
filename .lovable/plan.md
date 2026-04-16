

# Plano: Corrigir contadores de eventos, filtro de campanhas inativas e status "Ignorada"

## 3 problemas e suas causas

**1. Entraram/Saíram inconsistentes**
- Os cards usam `events.filter(e => e.action === "add").length` sobre os últimos 50 eventos carregados pelo hook
- Ao entrar novos eventos, os antigos saem da janela de 50 e o número diminui
- Solução: usar uma query de agregação separada (`COUNT(*) ... GROUP BY action`) que retorna totais reais do banco, com filtro de data (hoje, últimos 7 dias, etc.)

**2. Campanhas desativadas aparecem em "Amanhã"/"7 dias"**
- O filtro `todayMessages` (linha 2325) só verifica se `next_run_at` cai no range de datas — não verifica se a campanha ou mensagem está ativa
- Solução: adicionar checagem `m.is_active` e `campaign.is_active` no filtro para ranges futuros (tomorrow, week, all)

**3. Campanhas recém-ativadas mostram "Ignorada"/"Perdida"**
- O `isStaleInactiveDiagnostic` (linha 469) só limpa diagnósticos com `reason_code === "message_inactive"`
- Diagnósticos como `next_run_already_passed`, `campaign_inactive`, `once_expired_before_start` permanecem stale e vencem sobre o estado real
- Solução: expandir a limpeza para qualquer diagnóstico stale quando `isActive && hasTimer`

## Arquivos a alterar

### 1. `src/hooks/useGroupEvents.ts`
- Adicionar uma segunda query que faz `SELECT action, COUNT(*) FROM group_participant_events WHERE workspace_id = X AND created_at >= hoje GROUP BY action`
- Retornar `{ events, eventCounts, isLoading }`
- O feed continua com limit(50), os totais vêm da agregação

### 2. `src/components/grupos/GroupDashboardTab.tsx`
- Usar `eventCounts` para os cards Entraram/Saíram em vez de `events.filter()`
- Adicionar filtro de período (Hoje/7 dias/30 dias) nos cards

### 3. `deploy/backend/src/routes/groups-api.ts`
- No filtro `todayMessages` (linha 2325): para ranges `tomorrow`, `week`, `all`, excluir mensagens onde `m.is_active === false`
- Após resolver `campaignMap`, excluir mensagens cuja campanha está inativa para ranges futuros
- Expandir `isStaleInactiveDiagnostic` para cobrir qualquer diagnóstico stale: se `isActive && hasTimer`, ignorar diagnósticos com códigos `message_inactive`, `campaign_inactive`, `next_run_already_passed`, `message_inactive_at_dispatch`

### 4. `deploy/backend/src/lib/group-scheduler.ts`
- No `scheduleMessage`, limpar **qualquer** diagnóstico anterior quando `msg.is_active` (não só `message_inactive`)
- Isso garante que reativar uma campanha/mensagem sempre começa com estado limpo

## Resultado esperado
- Entraram/Saíram mostram totais reais do banco, estáveis independentemente da paginação do feed
- Campanhas desativadas não poluem as publicações de amanhã/semana
- Campanhas recém-ativadas refletem o estado real do timer

## Validação na VPS após deploy
```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT action, COUNT(*) FROM group_participant_events
WHERE created_at >= NOW() - INTERVAL '1 day'
GROUP BY action;
"
```

```bash
docker logs deploy-backend-1 --since=10m 2>&1 | grep -i "\[scheduler\]" | tail -30
```

