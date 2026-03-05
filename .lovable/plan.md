## ✅ Concluído: Corrigir fluxo não continuando após "Capturar Resposta"

### Correções aplicadas

1. **Migração**: Adicionada coluna `waiting_node_id` (text) na tabela `flow_executions`
2. **execute-flow**: Agora grava `waiting_node_id: node.id` ao pausar em waitForReply/waitForClick (standalone e grupo)
3. **webhook**: `checkAndResumeWaitingReply` usa `waiting_node_id` para encontrar a edge correta e retorna `true/false`
4. **webhook**: Se retomou fluxo, pula `checkAndTriggerFlows`
5. **webhook**: `checkAndTriggerFlows` bloqueia em status `running`, `waiting_click` E `waiting_reply`
