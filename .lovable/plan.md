
## Plano: salvar histórico completo e usar filtros sem perder nenhum período

### Objetivo confirmado
O sistema deve:
- salvar todos os eventos de grupos de forma permanente
- nunca depender só de “hoje” para persistência
- consultar qualquer período por filtro
- mostrar contagens corretas por grupo e no total

### Problemas encontrados no código atual
1. `src/hooks/useGroupEvents.ts` limita o feed a `100` eventos e o card por grupo está sendo calculado em cima desse feed limitado.
2. `deploy/backend/src/routes/webhook.ts` ainda grava eventos de grupo e altera `member_count`, enquanto `deploy/backend/src/routes/groups-webhook.ts` também grava eventos. Isso pode duplicar e contaminar contagens.
3. `deploy/backend/src/routes/groups-webhook.ts` atualiza `group_daily_stats` só para o dia atual, mas o histórico real precisa continuar vindo sempre de `group_participant_events`.
4. A exigência agora mudou: não pode existir lógica de “limpeza”, “janela curta” ou comportamento que trate histórico antigo como descartável.

### O que vou implementar

#### 1. Tornar `group_participant_events` a fonte oficial e permanente
- Manter todos os inserts de eventos nessa tabela.
- Não usar mais qualquer lógica que dependa de retenção curta para histórico.
- Garantir que filtros por período consultem essa tabela completa.

#### 2. Eliminar a duplicidade de origem
- Remover do `deploy/backend/src/routes/webhook.ts` toda lógica de eventos de grupo.
- Deixar somente `deploy/backend/src/routes/groups-webhook.ts` responsável por salvar eventos de entrada/saída/promoção/rebaixamento.
- Preservar deduplicação apenas contra webhook duplicado do mesmo evento, sem apagar histórico real.

#### 3. Corrigir a lógica do dashboard
Em `src/hooks/useGroupEvents.ts` vou separar:
- feed visual: últimos N eventos do período, só para listagem
- contadores totais do período: sem depender do feed limitado
- contadores por grupo do período: também sem depender do feed limitado

Assim:
- “Entraram/Saíram” no topo = total real filtrado
- `+X / -Y` em cada grupo = total real daquele grupo no período
- lista de eventos = apenas paginação/recorte visual, sem afetar métricas

#### 4. Manter `member_count` vindo do sync real
- `member_count` continua vindo do sync com a API real em `deploy/backend/src/routes/groups-api.ts`
- eventos não recalculam mais total de membros por incremento/decremento
- isso evita drift

#### 5. Ajustar período/filtro para histórico completo
- Revisar o cálculo de datas em `useGroupEvents.ts` para evitar distorção de timezone.
- Garantir que “hoje”, “ontem” e “personalizado” sejam só filtros de leitura, nunca limites de persistência.

#### 6. Preparar performance para guardar tudo
Como você quer histórico completo, vou incluir no plano uma revisão de índice para `group_participant_events`, para consultas por:
- `workspace_id`
- `group_jid`
- `created_at`
- `action`

Isso evita que o histórico completo degrade a busca.

### Arquivos que devem ser alterados
- `src/hooks/useGroupEvents.ts`
- `src/components/grupos/GroupDashboardTab.tsx`
- `deploy/backend/src/routes/webhook.ts`
- `deploy/backend/src/routes/groups-webhook.ts`
- `deploy/backend/src/routes/groups-api.ts`
- `supabase/migrations/*` (apenas se eu adicionar índice novo para performance)

### Resultado esperado
- nenhum evento histórico será descartado
- a UI vai consultar o histórico completo com base nos filtros
- o total do topo vai bater com a soma real dos grupos monitorados
- cada grupo vai mostrar corretamente quantos entraram e saíram no período selecionado
- `member_count` ficará separado da contagem de eventos e virá apenas do sync real
