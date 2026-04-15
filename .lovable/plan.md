
Objetivo: fazer as mensagens perdidas mostrarem o motivo exato, em vez de status genérico, sem depender de inferência frágil no frontend.

1. Diagnóstico do problema atual
- Hoje o backend de debug (`/scheduler-debug`) só retorna `missed: boolean`.
- O frontend (`SchedulerDebugPanel`) inventa o status com base em horário, timer e existência de itens na fila.
- O scheduler e o processador da fila têm vários caminhos de falha/skip, mas quase nenhum grava um diagnóstico estruturado.
- Resultado: o card mostra “Perdida” ou “Sem fila” sem dizer se foi por campanha inativa, sem grupos, deduplicação, rate limit, erro da API, falha ao inserir na fila ou falha ao disparar `queue/process`.

2. Ajuste no backend para persistir a causa exata
Arquivos:
- `deploy/backend/src/lib/group-scheduler.ts`
- `deploy/backend/src/routes/groups-api.ts`

Implementação:
- Criar um padrão único de diagnóstico para mensagens agendadas, por exemplo:
  - `missed_reason_code`
  - `missed_reason_label`
  - `missed_reason_details`
  - `diagnostics`
- Sempre que uma execução não puder seguir, gravar a causa exata no banco/fila:
  - campanha não encontrada
  - campanha inativa
  - campanha sem grupos
  - deduplicada
  - rate limit
  - erro ao inserir itens na fila
  - erro ao chamar `queue/process`
  - erro de envio pela API do WhatsApp
  - mensagem sem timer / timer perdido / execução passada sem processamento
- Onde já existe `error_message` na `group_message_queue`, enriquecer com texto objetivo e consistente.
- Para casos em que nem item de fila exista, o scheduler deve registrar diagnóstico no próprio agendamento antes de reagendar/pular.

3. Ajuste no endpoint de debug
Arquivo:
- `deploy/backend/src/routes/groups-api.ts`

Implementação:
- O endpoint `scheduler-debug` deve parar de retornar só `missed: true/false`.
- Passar a devolver, por mensagem:
  - `status_code`
  - `status_label`
  - `failure_reason`
  - `failure_details`
  - `diagnostics`
  - resumo dos erros de fila por grupo
- A regra de status deve ser calculada no backend, com prioridade clara:
  1. sent
  2. failed
  3. missed com motivo persistido
  4. skipped com motivo persistido
  5. processing
  6. waiting/timer ativo
- Assim o frontend só renderiza o que o backend já determinou.

4. Ajuste no frontend para exibir o motivo exato
Arquivos:
- `src/hooks/useSchedulerDebug.ts`
- `src/components/grupos/SchedulerDebugPanel.tsx`

Implementação:
- Atualizar os tipos do hook para receber os novos campos.
- Remover a lógica heurística que hoje deduz “perdida”.
- No card, mostrar:
  - status real vindo do backend
  - motivo exato logo abaixo do status, por exemplo:
    - “Campanha inativa no momento da execução”
    - “Nenhum grupo vinculado à campanha”
    - “Bloqueada por deduplicação de 5 min”
    - “Limite de envio por grupo atingido”
    - “Falha ao enviar via Evolution: [detalhe real]”
    - “Timer expirou sem enqueue”
- Se houver vários grupos com falhas diferentes, mostrar um resumo compacto e um detalhe expansível por grupo.
- Para evitar quebrar layout novamente, manter esse detalhe dentro do box do preview com altura/overflow próprios, sem influenciar os cards vizinhos.

5. Padronização das mensagens de erro
- Trocar mensagens genéricas por textos operacionais prontos para leitura.
- Exemplo:
  - ruim: “Sem fila”
  - bom: “Não entrou na fila porque a campanha estava sem grupos”
- Exibir a mensagem original da API somente como detalhe secundário, quando existir.

6. Verificação na VPS
Como você usa só a VPS, depois da implementação eu vou te entregar comandos prontos para validar:
- mensagens agendadas do dia
- itens da `group_message_queue`
- erros reais salvos
- diferença entre “não entrou na fila” e “entrou na fila mas falhou ao enviar”

7. Resultado esperado
- Cada publicação perdida passa a mostrar o motivo exato.
- O painel deixa de “adivinhar” e passa a refletir o estado real do backend.
- Fica possível saber imediatamente se o problema foi scheduler, fila, deduplicação, limite, campanha ou API de envio.

Detalhes técnicos
```text
Fluxo alvo:

scheduler/fireMessage
  -> tenta resolver campanha
  -> tenta montar queueItems
  -> tenta inserir fila
  -> tenta disparar queue/process
  -> registra diagnóstico estruturado em cada saída anormal

queue/process
  -> para cada item:
     dedup?      => status/diagnóstico exato
     rate limit? => status/diagnóstico exato
     send fail?  => status/diagnóstico exato com erro bruto anexado
     sent?       => status real de sucesso

scheduler-debug
  -> agrega:
     status real
     reason code
     label amigável
     detalhes por grupo
```
