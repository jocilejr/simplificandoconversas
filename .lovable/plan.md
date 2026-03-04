
## Plano: Mostrar fluxo "aguardando clique" como ativo e bloquear novos fluxos

### Problema

1. O `useFlowExecutions` filtra apenas `status = 'running'`, mas o `waitForClick` define o status como `'waiting_click'`. Por isso o painel lateral mostra "Nenhum fluxo em execução" mesmo com um fluxo pausado aguardando clique.

2. O botão de disparar fluxo no chat (ícone Bot) permite executar novos fluxos mesmo quando já existe um em andamento.

### Correções

#### 1. `useFlowExecutions` -- incluir status `waiting_click`

Alterar o filtro de `.eq("status", "running")` para `.in("status", ["running", "waiting_click"])`. Isso faz com que fluxos pausados no waitForClick apareçam no painel lateral e no chat.

#### 2. ChatPanel -- bloquear disparo quando há fluxo ativo

- Importar `useFlowExecutions` no `ChatPanel`
- Verificar se `activeExecutions?.length > 0`
- Desabilitar o botão Bot e mostrar tooltip/indicador de que já há um fluxo em execução
- Mostrar um banner discreto na área de chat indicando o fluxo ativo com opção de parar

#### 3. RightPanel -- ajustar texto para `waiting_click`

Diferenciar visualmente o status "waiting_click" (ex: ícone de relógio em vez de spinner, texto "Aguardando clique") do status "running" (spinner + "Executando").

### Arquivos editados

- `src/hooks/useFlowExecutions.ts` -- filtro de status
- `src/components/conversations/ChatPanel.tsx` -- bloquear novos fluxos + mostrar indicador
- `src/components/conversations/RightPanel.tsx` -- ajuste visual para waiting_click
