

## Analise

O fluxo atual (`execute-flow`) roda inteiramente server-side numa unica requisicao HTTP. Nao ha mecanismo de tracking de execucoes ativas nem forma de interrompe-las. Para permitir "pausar/cancelar" um fluxo em execucao, precisamos de um sistema de estado persistido no banco.

## Plano

### 1. Banco de Dados -- nova tabela `flow_executions`

Tabela para rastrear execucoes ativas de fluxos por conversa:

- `id` (uuid, PK)
- `user_id` (uuid, not null)
- `conversation_id` (uuid, FK conversations)
- `flow_id` (uuid, FK chatbot_flows)
- `remote_jid` (text, not null)
- `status` (text: 'running', 'paused', 'completed', 'cancelled')
- `current_node_index` (integer, default 0) -- para retomar se necessario
- `created_at`, `updated_at`
- RLS: cada usuario ve/edita apenas os seus

### 2. Edge Function `execute-flow` -- verificar cancelamento

Modificar o loop BFS para, a cada iteracao de no, consultar a tabela `flow_executions` e checar se o status mudou para `'cancelled'` ou `'paused'`. Se sim, interromper a execucao imediatamente.

Fluxo:
1. Ao iniciar, inserir registro em `flow_executions` com status `'running'`
2. Antes de executar cada no, fazer SELECT do status
3. Se `cancelled`/`paused`, parar e retornar
4. Ao finalizar, atualizar status para `'completed'`

### 3. RightPanel -- botao de parar fluxo

Adicionar uma secao no painel lateral (RightPanel) entre as info do contato e as etiquetas:

- Mostrar execucoes ativas (status = `'running'`) para a conversa selecionada
- Botao vermelho "Parar Fluxo" que faz UPDATE do registro para `status = 'cancelled'`
- Quando nao ha fluxo ativo, mostrar indicador discreto "Nenhum fluxo em execucao"

### 4. Hook `useFlowExecutions`

Hook para:
- Listar execucoes ativas por `conversation_id`
- Mutation para cancelar (UPDATE status = 'cancelled')

### 5. Arquivos impactados

- **Criar**: `src/hooks/useFlowExecutions.ts`
- **Editar**: `supabase/functions/execute-flow/index.ts`, `src/components/conversations/RightPanel.tsx`
- **Migracao SQL**: 1 arquivo com tabela `flow_executions` + RLS

