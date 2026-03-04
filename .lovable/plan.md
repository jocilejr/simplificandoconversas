## Agrupamento de Nos estilo ManyChat

### Conceito

No ManyChat, multiplos steps (enviar texto, enviar imagem, delay, etc.) se empilham verticalmente dentro de um unico "bloco". O bloco tem um handle de entrada (esquerda) e um de saida (direita). O Gatilho se conecta ao bloco via edge, e blocos se conectam entre si.

```text
┌─────────────┐          ┌─────────────────┐          
│   Gatilho   │────────▶ │  Enviar Texto   │
└─────────────┘          │  Aguardar 3s    │           ┌─────────────┐       
                         │  Enviar Imagem  │────────▶  │  Enviar IMG │
                         └─────────────────┘           └─────────────┘
```

### Como funciona

- Ao arrastar um no proximo de outro (ou de um grupo existente), um **indicador visual azul** aparece mostrando que o no sera acoplado
- Ao soltar, o no e adicionado ao grupo (empilhado abaixo)
- O grupo e um unico no ReactFlow do tipo `"group"` cujo `data.steps` contem um array dos steps internos
- Cada step dentro do grupo tem seu proprio UUID e dados
- Gatilhos nunca se agrupam — sao sempre nos independentes
- Dentro do grupo, os steps podem ser reordenados via drag interno
- Para desagrupar, basta arrastar o step para fora do grupo

### Plano de Implementacao

**1. Tipo `group` em `types/chatbot.ts**`

- Adicionar tipo `"group"` ao `FlowNodeType`
- Adicionar campo `steps?: { id: string; data: FlowNodeData }[]` ao `FlowNodeData`
- O grupo tem label, cor neutra, e renderiza seus steps empilhados

**2. Novo componente `GroupNode.tsx**`

- Renderiza uma card com borda arredondada contendo os steps empilhados
- Cada step mostra: barra de cor + icone + label + preview do conteudo
- Handle target na esquerda, handle source na direita
- Largura fixa de 280px
- Ao clicar em um step, abre o PropertiesPanel para aquele step

**3. Logica de proximidade no `FlowEditor.tsx**`

- `onNodeDrag`: calcular distancia entre o no sendo arrastado e outros nos/grupos
- Se distancia < 50px (e o no arrastado nao e trigger): mostrar highlight no alvo
- `onNodeDragStop`: se dentro da zona de proximidade:
  - Se alvo e um no standalone: criar grupo com ambos
  - Se alvo e um grupo: adicionar step ao grupo
- Estado `dropTarget` para controlar o highlight visual

**4. Atualizar `StepNode.tsx**`

- Adicionar prop visual para indicar quando e alvo de dock (borda azul pulsante)

**5. Atualizar `PropertiesPanel.tsx**`

- Quando no selecionado e grupo: mostrar lista de steps, permitir selecionar um step para editar
- Edicao de step individual dentro do grupo

**6. Atualizar `execute-flow` edge function**

- Ao encontrar um no do tipo `group`: iterar `steps[]` sequencialmente (mesma logica atual por tipo de step)
- Manter compatibilidade com nos standalone

**7. Atualizar `evolution-webhook**`

- Ao buscar triggers: verificar tanto nos standalone com `type=trigger` quanto steps dentro de grupos

### Arquivos impactados

- **Editar**: `src/types/chatbot.ts` (tipo group, campo steps)
- **Criar**: `src/components/chatbot/GroupNode.tsx`
- **Editar**: `src/components/chatbot/FlowEditor.tsx` (logica de proximidade + merge)
- **Editar**: `src/components/chatbot/StepNode.tsx` (indicador de dock)
- **Editar**: `src/components/chatbot/PropertiesPanel.tsx` (edicao de steps em grupo)
- **Editar**: `supabase/functions/execute-flow/index.ts` (processar tipo group)
- **Editar**: `supabase/functions/evolution-webhook/index.ts` (buscar triggers em grupos)