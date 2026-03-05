## Remover seleção/opções do grupo e adicionar lixeira externa

### Alterações

**1. `src/components/chatbot/FlowEditor.tsx**`

- No `onNodeClick`, quando o nó clicado for `groupBlock`, abrir o painel de propriedades apenas se um step interno (`data-step-id`) foi clicado. Se clicou no grupo em si (header, área vazia), não selecionar o nó — manter `selectedNodeId` como `null`.
- Adicionar listener para evento customizado `group-delete` que remove o grupo e suas edges, com confirmação via `AlertDialog` ou `window.confirm`.

**2. `src/components/chatbot/GroupNode.tsx**`

- Remover o comportamento de seleção visual do grupo (border `selected`). O grupo só deve ser arrastável pelo header.
- Adicionar um botão de lixeira (`Trash2`) posicionado **fora** da box, no canto superior direito (`absolute -top-3 -right-3`), visível apenas no hover do grupo.
- Ao clicar na lixeira, disparar evento customizado `group-delete` com o `nodeId`.
- No `FlowEditor`, capturar esse evento e mostrar um `AlertDialog` de confirmação com "Você tem certeza que deseja apagar o grupo?" antes de deletar.

### Detalhes técnicos

- O botão da lixeira fica em `position: absolute` fora do card, usando classes como `-top-3 -right-3` com `opacity-0 group-hover/card:opacity-100` (usando um grupo Tailwind no container).
- A confirmação será implementada com estado `deleteGroupId` no `FlowEditor` e o componente `AlertDialog` já existente no projeto.
- Ao confirmar, remove o nó e todas as edges conectadas a ele.
- Remover a lógica que marca o grupo como `selected` visualmente (sem border highlight ao clicar).  
  
O Nó de aguardar deve ter uma versão avançada, onde consigo estipular por exmeplo: 3 a 9 segundos aleatoriamente. Isso para ter uma randomização de timing e evitar bloqueios

### Arquivos alterados

- `src/components/chatbot/GroupNode.tsx`
- `src/components/chatbot/FlowEditor.tsx`