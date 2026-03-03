

## Melhorias no BlockNode: Reordenacao + Diferenciacao Visual + Design Profissional

### 1. Reordenacao de sub-itens (setas cima/baixo)

Adicionar botoes de seta (ChevronUp/ChevronDown) que aparecem no hover de cada child dentro do bloco. Ao clicar, trocam a posicao do child com o anterior/proximo no array `children`.

- **BlockNode.tsx**: Adicionar botoes de seta com `data-move-up={index}` e `data-move-down={index}`
- **FlowEditor.tsx**: No `onNodeClick`, detectar `data-move-up` / `data-move-down` e fazer swap no array de children

### 2. Diferenciacao visual por tipo de child

Cada child dentro do bloco tera uma faixa lateral colorida (left border) usando a cor do `nodeTypeConfig` e um mini-icone Lucide, para diferenciar visualmente texto, audio, imagem, video, condicao, timer, etc.

- **BlockNode.tsx**: No render de cada child (nao-delay), adicionar `borderLeft: 3px solid config.color` e renderizar o icone Lucide do tipo ao lado do conteudo. Para delays, manter o badge pill mas com a cor do config.

### 3. Redesign profissional estilo ManyChat

Mudancas visuais no BlockNode e no canvas para um look mais limpo e profissional:

**BlockNode.tsx**:
- Header com gradiente sutil em vez de cor solida plana
- Bordas mais suaves, sombras mais refinadas
- Tipografia mais limpa, espacamentos melhores
- Footer "Proximo Passo" com icone de seta
- Handles com estilo mais polido (cor primaria quando conectado)

**FlowEditor.tsx**:
- Background com grid pattern mais sutil
- Edges com curvas suaves (tipo `smoothstep` ou `bezier`) e cor mais elegante
- Botoes do painel com design mais refinado

**index.css**:
- Adicionar estilos CSS para os nodes do React Flow (sombras, transicoes)

### Arquivos a alterar

1. **`src/components/chatbot/BlockNode.tsx`** - Redesign completo do componente: faixa lateral colorida por tipo, icone por tipo, botoes de reordenacao, visual profissional
2. **`src/components/chatbot/FlowEditor.tsx`** - Handler de reordenacao no `onNodeClick`, edge style default com smoothstep/bezier
3. **`src/index.css`** - Estilos adicionais para nodes do React Flow

