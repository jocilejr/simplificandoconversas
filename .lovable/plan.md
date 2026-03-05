

## Adicionar seleção de tipo de presença no nó "Aguardar"

### Alterações

**`src/types/chatbot.ts`**
- Adicionar campo `delayPresenceType?: "composing" | "recording"` ao `FlowNodeData`
- Atualizar `defaultNodeData.waitDelay` com `delayPresenceType: "composing"`

**`src/components/chatbot/PropertiesPanel.tsx`**
- Substituir o switch "Simular digitando..." (linhas 165-168) por um `Select` com 3 opções:
  - `none` → Nenhuma simulação
  - `composing` → Digitando...
  - `recording` → Gravando áudio...
- Manter o campo `simulateTyping` sincronizado (true quando não for "none")

**`src/components/chatbot/StepNode.tsx`**
- Atualizar `renderDescription` do `waitDelay` para exibir "digitando..." ou "gravando..." conforme `delayPresenceType`

**`src/components/chatbot/GroupNode.tsx`**
- Atualizar a descrição inline do step waitDelay para refletir o tipo de presença selecionado

**`supabase/functions/execute-flow/index.ts`**
- Na execução do `waitDelay`, enviar `sendPresence` com `"composing"` ou `"recording"` conforme `delayPresenceType`, seguido de `"paused"` ao final do delay

