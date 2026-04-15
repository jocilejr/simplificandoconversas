
Objetivo: redesenhar o painel para um carrossel profissional de 3 cards horizontais fixos e corrigir o bug em que mensagens importadas só passam a enviar depois de editar/reprogramar.

Diagnóstico confirmado

1. UI
- O `SchedulerDebugPanel.tsx` ainda usa um trilho de scroll “livre”, com muitos cards verticais, muitos sinais visuais de rolagem e baixa hierarquia.
- O layout atual mostra informação demais empilhada e o preview ocupa espaço de forma pouco eficiente.

2. Bug das mensagens importadas
- Em `deploy/backend/src/routes/groups-api.ts`, o endpoint `POST /import-backup` insere as mensagens, calcula `next_run_at`, mas não registra essas mensagens no scheduler em memória.
- Em `PUT /campaigns/:id`, quando a campanha é ativada/desativada, o backend só atualiza `is_active` da campanha e não sincroniza os timers das mensagens filhas.
- Por isso a mensagem importada só funciona depois de editar a própria mensagem, porque o `PUT /campaigns/:id/messages/:msgId` chama `groupScheduler.scheduleMessage(...)`.

Plano de implementação

1. Redesenhar o painel para 3 cards horizontais fixos
Arquivo principal: `src/components/grupos/SchedulerDebugPanel.tsx`

- Trocar o carrossel baseado em scroll por uma “stage” fixa com 3 slots.
- Cada card ocupará aproximadamente 1/3 da box.
- O card central será o foco:
  - escala normal
  - borda/realce mais forte
  - conteúdo 100% nítido
- Os cards lateral esquerdo/direito:
  - escala levemente menor
  - opacidade menor
  - blur sutil apenas na área visual, sem prejudicar leitura dos metadados
- Remover indicadores de scroll desnecessários:
  - sem scrollbar visível
  - sem efeito de “lista infinita” feio
  - manter apenas setas discretas e contador

2. Reestruturar o conteúdo interno do card
Arquivos: `src/components/grupos/SchedulerDebugPanel.tsx` e, se necessário, `src/components/grupos/WhatsAppPreview.tsx`

Novo layout do card:
- Esquerda: informações operacionais
  - horário
  - tipo
  - status
  - campanha
  - grupos-alvo
  - motivo/diagnóstico
  - resumo de fila
- Direita: preview do conteúdo que será enviado
- Card em formato horizontal, com altura menor e leitura mais limpa
- Se precisar, criar um modo “compacto” do `WhatsAppPreview` para caber melhor nessa visualização

Estrutura visual:
```text
[ card anterior ] [ card atual ] [ próximo card ]
    menor/blurl        destaque        menor/blurl

Dentro do card:
[ infos/status/diagnóstico ] [ preview WhatsApp ]
```

3. Garantir que a box continue fixa e elegante
- Manter a viewport do painel com largura fixa/responsiva, sem crescer conforme a quantidade de programações
- Centralizar sempre o card ativo
- Nas extremidades, usar espaçadores/ghost slots para o card atual continuar centralizado mesmo no primeiro/último item

4. Corrigir o bug do import no backend
Arquivo: `deploy/backend/src/routes/groups-api.ts`

Implementar uma sincronização real entre campanha e scheduler:
- Ao ativar a campanha (`PUT /campaigns/:id` com `isActive=true`):
  - buscar todas as `group_scheduled_messages` ativas da campanha
  - recalcular `next_run_at` quando estiver nulo ou vencido
  - persistir o novo `next_run_at`
  - chamar `groupScheduler.scheduleMessage(...)` para cada mensagem ativa
- Ao desativar a campanha:
  - cancelar os timers das mensagens filhas com `groupScheduler.cancelMessage(...)`
  - isso evita “perdidas” falsas enquanto a campanha estiver pausada

5. Blindar o fluxo de importação
Arquivo: `deploy/backend/src/routes/groups-api.ts`

No `POST /import-backup`:
- manter campanhas importadas como inativas
- manter mensagens importadas com seus dados
- deixar a ativação da campanha ser o gatilho oficial para registrar os timers
- assim o sistema fica consistente: importar, ativar a campanha, scheduler registra tudo sem precisar editar mensagem por mensagem

Resultado esperado

- Painel visualmente mais premium e profissional
- Apenas 3 cards visíveis por vez
- Card atual no centro, anterior e próximo menores e com blur sutil
- Preview à direita, informações à esquerda
- Sem poluição visual de scroll
- Mensagens importadas passam a enviar ao ativar a campanha, sem precisar “reprogramar”

Validação na VPS

Depois da implementação, eu vou te orientar a validar dentro da VPS com estes comandos:

1. Logs do backend
```bash
BACK=$(docker ps --format '{{.Names}}' | grep -E 'backend' | head -n1)
docker logs --tail=400 "$BACK" | grep -E 'import-backup|Created message|Timer set|Skipping msg|campaign_inactive|scheduleMessage|scheduler'
```

2. Conferir campanhas e mensagens importadas
```bash
DB=$(docker ps --format '{{.Names}}' | grep -E '^deploy-postgres-1$|postgres' | head -n1)
docker exec -i "$DB" psql -U postgres -d postgres -c "
select
  c.name as campanha,
  c.is_active as campanha_ativa,
  m.id as mensagem_id,
  m.is_active as mensagem_ativa,
  m.schedule_type,
  m.scheduled_at,
  m.next_run_at,
  m.created_at
from group_scheduled_messages m
join group_campaigns c on c.id = m.campaign_id
order by m.created_at desc
limit 40;
"
```

Detalhe técnico
- A causa do bug não é a data em si.
- O problema é de registro do timer em memória:
  - importar cria a linha no banco
  - editar chama `scheduleMessage`
  - ativar campanha hoje não chama nada para as mensagens filhas
- A correção correta é sincronizar timers no momento em que a campanha muda de estado, não obrigar edição manual da mensagem.
