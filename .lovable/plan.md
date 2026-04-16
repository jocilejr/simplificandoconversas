

# Plano: Corrigir exibição de programações e status "Ignorada" falso

## Problema identificado

Dois problemas distintos:

1. **Programações não aparecem no painel**: O endpoint `/scheduler-debug` filtra apenas mensagens cujo `next_run_at` ou `last_run_at` cai **dentro do dia de hoje BRT** (linhas 2270-2272). Ao ativar uma campanha nova, o `calculateFirstRunAt` pode calcular o `next_run_at` para **amanhã ou outro dia** (ex: se os `weekDays` não incluem o dia atual). Resultado: a programação das 22h simplesmente não aparece porque o `next_run_at` está num dia futuro.

2. **Status "Ignorada" indevido**: Para mensagens cujo horário já passou no momento da ativação, o `resolveSchedulerStatus` chega em `isPast=true` sem queue items, resultando em "Perdida" ou "Ignorada".

## Solução

### 1. Backend — Expandir filtro do `/scheduler-debug`
**Arquivo:** `deploy/backend/src/routes/groups-api.ts`

- Aceitar query param `range` (`today` | `tomorrow` | `week` | `all`), default `today`
- Para `today`: manter lógica atual
- Para `tomorrow`: `todayStartBrt` + 1 dia
- Para `week`: 7 dias a partir de hoje
- Para `all`: não filtrar por data, apenas mensagens ativas com `next_run_at` futuro ou `last_run_at` recente (últimos 7 dias)
- Incluir `updated_at` no select para diagnósticos mais precisos

### 2. Frontend — Adicionar seletor de período
**Arquivo:** `src/hooks/useSchedulerDebug.ts`

- Adicionar parâmetro `range` na URL da query
- Incluir `range` na `queryKey`

**Arquivo:** `src/components/grupos/SchedulerDebugPanel.tsx`

- Adicionar tabs compactas no header: **Hoje | Amanhã | 7 dias | Todas**
- Atualizar título dinâmico ("Publicações de Hoje" → "Publicações da Semana" etc.)
- Passar `range` para o hook

### 3. Backend — Corrigir status "Ignorada" falso para mensagens recém-ativadas
**Arquivo:** `deploy/backend/src/routes/groups-api.ts`

Na `resolveSchedulerStatus`, antes de retornar "Perdida"/"Ignorada" para `isPast`:
- Verificar se a mensagem foi ativada recentemente (via `updated_at`) — se `updated_at` > `effective_run_at`, o status deveria ser "Sem timer" ou "Aguardando recálculo", não "Ignorada"
- Isso cobre o caso onde a campanha foi ativada depois do horário já ter passado

### Resultado
- O usuário verá todas as programações futuras, não só as de hoje
- Programações recém-ativadas não mostrarão "Ignorada" indevidamente
- A programação das 22h aparecerá corretamente no painel

