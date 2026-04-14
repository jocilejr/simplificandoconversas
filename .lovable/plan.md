

# Dashboard de Debug Completo do Scheduler

## Resumo

Criar um painel de debug detalhado que mostra o estado completo de cada mensagem agendada: futuras com timer ativo/ausente, passadas com status de envio por grupo, horarios de entrada na fila e envio, falhas, e detecção de "timer passou mas não enviou".

## Backend — Novo endpoint

**Arquivo:** `deploy/backend/src/routes/groups-api.ts`

Novo `GET /groups/scheduler-debug?workspaceId=...` que retorna:

1. **Todas as mensagens agendadas** (ativas e inativas do dia) com join em `group_campaigns` para nome
2. **Status do timer in-memory** via `groupScheduler.hasTimer(msgId)` e `groupScheduler.activeCount`
3. **Itens da fila associados** — para cada `scheduled_message_id`, busca em `group_message_queue` os registros das ultimas 24h com: `status`, `group_jid`, `group_name`, `created_at` (entrada na fila), `started_at`, `completed_at`, `error_message`
4. **Detecção de anomalia**: se `next_run_at` está no passado, `is_active = true`, e não há item na fila recente → flag `missed: true`

Resposta:
```json
{
  "timers_active": 42,
  "server_time_utc": "...",
  "server_time_brt": "...",
  "messages": [{
    "id": "...",
    "schedule_type": "weekly",
    "message_type": "text",
    "is_active": true,
    "next_run_at": "...",
    "last_run_at": "...",
    "has_timer": true,
    "missed": false,
    "campaign_name": "Campanha X",
    "content_preview": "Texto da mensagem...",
    "queue_items": [{
      "group_jid": "...",
      "group_name": "Grupo Y",
      "status": "sent",
      "created_at": "...",
      "started_at": "...",
      "completed_at": "...",
      "error_message": null
    }]
  }]
}
```

## Frontend — 3 novos arquivos + 1 modificado

### `src/hooks/useSchedulerDebug.ts`
- useQuery com polling de 30s
- Busca `GET /groups/scheduler-debug?workspaceId=...`

### `src/components/grupos/SchedulerDebugPanel.tsx`
Card completo com:
- **Header**: Timers ativos, horario do servidor (BRT), botao de refresh
- **Filtros**: Todas / Futuras / Passadas / Com problemas
- **Lista cronologica** de cada mensagem agendada mostrando:
  - Horario BRT (destaque visual: passada=esmaecida, proxima=highlight, futura=normal)
  - Badge tipo (text/image/audio/file)
  - Nome da campanha
  - Indicador timer: verde (ativo) / vermelho (ausente) / amarelo (missed — timer passou sem enviar)
  - `last_run_at` formatado
- **Expansivel por mensagem**: ao clicar, mostra tabela detalhada dos `queue_items`:
  - Grupo (nome + JID curto)
  - Status com cor (sent=verde, failed=vermelho, pending=amarelo, cancelled=cinza, processing=azul)
  - Horario entrada na fila (`created_at`)
  - Horario inicio processamento (`started_at`)
  - Horario conclusao (`completed_at`)
  - Tempo total (completed - created)
  - Mensagem de erro (se houver)
- **Contadores por mensagem**: X enviadas, Y falhas, Z canceladas

### `src/components/grupos/GroupDashboardTab.tsx`
- Importar e adicionar `SchedulerDebugPanel` como card full-width abaixo dos cards existentes

## Detecção de problemas (visual)

- **Timer ausente**: mensagem ativa com `next_run_at` futuro mas `has_timer = false` → badge vermelho "Sem Timer"
- **Missed**: `next_run_at` no passado, `is_active = true`, sem queue items recentes → badge amarelo "Perdida"
- **Falha total**: todos queue_items com status `failed` → badge vermelho "Falhou"
- **OK**: timer ativo ou já executou com sucesso → badge verde

## Pós-deploy

```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose up -d --build backend
```

