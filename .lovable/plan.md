

## Plano: Corrigir fluxo não continuando após "Capturar Resposta"

### Problema identificado

Há 3 bugs interligados no webhook e no executor:

1. **`checkAndResumeWaitingReply` encontra o nó errado**: Ela itera TODOS os nós do fluxo e pega o PRIMEIRO `waitForReply` que encontrar, não o que realmente estava pausado. Se houver múltiplos grupos com `waitForReply`, sempre retoma do primeiro — causando o loop.

2. **`checkAndTriggerFlows` roda APÓS a retomada**: Após completar a execução antiga e disparar a retomada, o webhook ainda roda `checkAndTriggerFlows`. Se o texto da resposta do contato bater com a keyword do trigger, ele inicia o fluxo DO ZERO novamente.

3. **Bloqueio incompleto no trigger**: `checkAndTriggerFlows` só verifica execuções com status `"running"`, ignorando `"waiting_reply"` e `"waiting_click"`. Então mesmo sem o bug 2, um novo fluxo poderia ser disparado enquanto outro está pausado.

### Correções

**1. Migração: adicionar `waiting_node_id` na tabela `flow_executions`**
- Coluna `text nullable` para armazenar o ID do nó que está em espera.

**2. `execute-flow/index.ts` — Salvar o `waiting_node_id` ao pausar**
- Quando o executor seta `waiting_reply` ou `waiting_click`, também gravar `waiting_node_id: node.id` (ou `node.id` do grupo que contém o step).

**3. `evolution-webhook/index.ts` — Usar `waiting_node_id` para retomar corretamente**
- Em `checkAndResumeWaitingReply`: ler o `waiting_node_id` da execução, encontrar a edge de saída (output-0) desse nó específico, e retomar a partir do target correto.
- Retornar `true` se retomou um fluxo.

**4. `evolution-webhook/index.ts` — Pular trigger se retomou**
- Se `checkAndResumeWaitingReply` retornou `true`, não chamar `checkAndTriggerFlows`.

**5. `evolution-webhook/index.ts` — Bloquear trigger em TODOS os status ativos**
- Em `checkAndTriggerFlows`, verificar execuções com status `in("running", "waiting_click", "waiting_reply")` ao invés de apenas `"running"`.

### Arquivos alterados
- Nova migração SQL (1 coluna)
- `supabase/functions/execute-flow/index.ts` (4 pontos: standalone waitForClick, standalone waitForReply, group waitForClick, group waitForReply)
- `supabase/functions/evolution-webhook/index.ts` (3 funções: checkAndResumeWaitingReply, checkAndTriggerFlows, chamada no handler principal)

