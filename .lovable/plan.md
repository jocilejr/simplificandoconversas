

## Diagnóstico

Analisei os dados no banco e os logs da edge function. O status "Aguardando resposta" funciona corretamente **quando a execução possui `conversation_id`**, mas existem execuções com `conversation_id: null` que ficam invisíveis na UI.

**Evidência no banco:**
- Execução `9b3fbe69` (waitForReply): `conversation_id = null` → invisível no chat
- Execução `bcb90e39` (waitForReply): `conversation_id = 235d206a` → visível no chat

**Causa raiz:** Quando `check-timeouts` resume um fluxo, ele passa `conversationId: timeout.conversation_id`. Se o timeout original foi criado com `conversation_id: null` (porque a execução original não tinha), todos os fluxos subsequentes herdam esse null. O `useFlowExecutions` filtra por `conversation_id`, então essas execuções nunca aparecem no banner.

**Bug secundário:** `checkAndResumeWaitingReply` não filtra por `instance_name`, podendo retomar a execução errada se o mesmo contato estiver em múltiplas instâncias.

---

## Correções

### 1. `supabase/functions/execute-flow/index.ts` — Garantir conversation_id
Após receber os parâmetros, se `conversationId` não foi fornecido, buscar automaticamente da tabela `conversations` usando `user_id + remote_jid + instance_name`. Isso garante que TODA execução tenha `conversation_id`, independentemente de quem a disparou.

### 2. `supabase/functions/evolution-webhook/index.ts` — Filtrar por instance_name
Na função `checkAndResumeWaitingReply`, adicionar `.eq("instance_name", instanceName)` na query que busca execuções em `waiting_reply`. Isso previne que uma mensagem em uma instância resuma o fluxo de outra instância.

### 3. `supabase/functions/check-timeouts/index.ts` — Buscar conversation_id se null
Antes de chamar `execute-flow`, se `timeout.conversation_id` for null, buscar da tabela `conversations` usando `remote_jid + user_id`. Isso corrige timeouts legados que não tinham o valor.

