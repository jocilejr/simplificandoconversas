## Problema

O erro `foreign key constraint "flow_executions_conversation_id"` ocorre porque as tabelas `flow_executions`, `flow_timeouts` e `tracked_links` referenciam `conversations.id`. Ao tentar deletar conversas, essas linhas dependentes bloqueiam a exclusao.

## Alteracoes

### 1. `src/components/settings/ConnectionsSection.tsx` — handleDeleteAllConversations

Adicionar delecao das tabelas dependentes **antes** de deletar conversations:

```
flow_timeouts → flow_executions → tracked_links → messages → conversation_labels → conversations
```

### 2. `src/hooks/useConversations.ts` — deleteConversation (individual)

Mesma logica: antes de deletar uma conversa individual, deletar `flow_timeouts`, `flow_executions` e `tracked_links` associados a ela.

### 3. Sobre o erro de edge function no sync

Estou tendo erro no edge function do sync, mas ele funciona para puxar as conversas. (Isso ocorre na VPS)