

# Scheduler Real-Time com Timers In-Memory

## Resumo da abordagem

Substituir o cron de polling (query no banco a cada minuto) por **timers in-memory** (`setTimeout`) que disparam no momento exato. Mensagens no passado são **ignoradas** (não entram na fila), apenas recalcula-se o próximo horário.

## Impacto na VPS: Cron vs Timers

```text
                        CRON ATUAL                    TIMERS IN-MEMORY
─────────────────────────────────────────────────────────────────────────
Queries ao banco        1 query/minuto (sempre)       0 queries em idle
                        + N queries por msg due       queries só quando dispara
CPU em idle             Constante (polling)           Zero (setTimeout dorme)
RAM extra               Nenhuma                       ~1KB por timer (Map entry)
                                                      ~90 msgs = ~90KB (nada)
Precisão                ±60 segundos                  ±1 segundo
Risco de bulk fire      ALTO (janela pega tudo)       ZERO (1 timer = 1 msg)
Risco de duplicação     Possível (race condition)     Impossível (timer único)
Queries no startup      Nenhuma                       1 query (carrega tudo)
─────────────────────────────────────────────────────────────────────────
```

**Conclusão: os timers são MAIS LEVES que o cron atual.** O cron faz 1 query por minuto (1.440/dia) mesmo quando não tem nada para enviar. Os timers fazem 0 queries em idle e só acessam o banco quando realmente precisam disparar.

## Regra de ouro: mensagens passadas = ignorar

- No startup, se `next_run_at` já passou: **não envia**. Calcula o próximo `next_run_at` e agenda o timer.
- Em caso de crash/restart: mesmo comportamento. Pula o que perdeu e agenda o próximo.
- Nunca haverá bulk fire.

## Alterações

### 1. `deploy/backend/src/index.ts`

**Remover:** O cron `"* * * * *"` do group scheduler (linhas 195-309).

**Adicionar:** Classe `GroupSchedulerManager` com:
- `Map<string, NodeJS.Timeout>` — um timer por `message_id`
- `loadAll()` — no startup, carrega mensagens ativas, para cada uma:
  - Se `next_run_at` no passado: recalcula próximo e salva no banco (sem enfileirar)
  - Se `next_run_at` no futuro: cria `setTimeout` com o delay correto
- `scheduleMessage(msg)` — cria/recria timer para uma mensagem
- `cancelMessage(msgId)` — cancela timer (quando user deleta/desativa)
- `fireMessage(msg)` — mesma lógica atual de enfileiramento, com as correções:
  - Só avança `next_run_at` se `queueItems.length > 0`
  - Não desativa msg se campanha está inativa (apenas pula)
  - Logs detalhados quando nada é enfileirado

**Manter:** Um cron de segurança leve a cada 5 minutos que verifica se há mensagens ativas sem timer (edge case de crash durante processamento). Este cron **não enfileira** — apenas recria timers faltantes.

### 2. `deploy/backend/src/routes/groups-api.ts`

- Nas rotas de CRUD de mensagens agendadas (criar/editar/deletar/toggle): chamar `scheduler.scheduleMessage()` ou `scheduler.cancelMessage()` para que o timer seja criado/cancelado imediatamente quando o usuário interage pela UI.
- Exportar a instância do scheduler para uso no index.

### 3. Correções incluídas

- **Não avançar schedule se 0 itens enfileirados** — protege contra consumo vazio
- **Não desativar msg quando campanha inativa** — apenas pula
- **Logs para cada caso** — "campanha inativa", "sem grupos", "tudo dedup"
- **BRT/UTC** — já está no código fonte, o rebuild ativa

## Pós-deploy na VPS

```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose up -d --build backend

# Resetar next_run_at para recálculo limpo
docker compose exec -T postgres psql -U postgres -d postgres -c "
UPDATE group_scheduled_messages SET next_run_at = NULL WHERE is_active = true;
"
docker compose restart backend

# Verificar timers carregados
docker compose logs -f backend 2>&1 | grep -i "scheduler"
```

