

## Plano: Vincular fluxos a instâncias específicas

### Resumo
Adicionar um campo `instance_names` (array de texto) na tabela `chatbot_flows` para que cada fluxo possa ser vinculado a uma ou mais instâncias. Se o array estiver vazio/nulo, o fluxo responde em todas as instâncias (comportamento atual). Se tiver instâncias selecionadas, só dispara nelas.

### Alterações

**1. Migração de banco de dados**
- Adicionar coluna `instance_names text[] default '{}'` na tabela `chatbot_flows`.

**2. UI — Card do fluxo (`ChatbotBuilder.tsx`)**
- Exibir badges com os nomes das instâncias vinculadas no card do fluxo (ou "Todas" se vazio).

**3. UI — Seletor de instâncias no FlowEditor**
- Adicionar um botão/popover no header do FlowEditor (ao lado do nome do fluxo) que lista as instâncias do usuário com checkboxes.
- O estado é salvo junto com o fluxo via `onSave`.
- Usar o hook `useEvolutionInstances` já existente para listar as instâncias disponíveis.

**4. Hook `useChatbotFlows.ts`**
- Incluir `instance_names` no tipo `ChatbotFlow` e no `updateFlow`.

**5. Webhook (`evolution-webhook/index.ts`)**
- Na função `checkAndTriggerFlows`, após encontrar um fluxo ativo com keyword match, verificar se `flow.instance_names` é vazio (aceita tudo) ou se contém o `instanceName` atual. Se não contiver, pular o fluxo.

### Detalhes técnicos

Filtro no webhook (pseudocódigo):
```typescript
// Após keyword match, antes de executar:
const allowedInstances = flow.instance_names || [];
if (allowedInstances.length > 0 && !allowedInstances.includes(instanceName)) {
  continue; // skip this flow for this instance
}
```

Seletor de instâncias no FlowEditor: Popover com lista de checkboxes das instâncias ativas do usuário. Se nenhuma selecionada, texto indica "Todas as instâncias".

