

## Redesign Completo dos Blocos — Estilo ManyChat Profissional

O design atual tem problemas: header com gradiente excessivo, handles como circulos soltos, card sem refinamento. Vou refazer o BlockNode com um visual limpo e profissional inspirado no ManyChat.

### Mudancas no BlockNode.tsx

**Header:**
- Fundo solido com a cor do tipo (sem gradiente forte), opacidade sutil
- Barra lateral colorida fina (4px) no lado esquerdo do card inteiro, nao no header
- Header mais compacto com icone + titulo em uma linha limpa
- Fundo do header em tom bem claro da cor (10% opacidade)

**Handles de conexao:**
- Handle de entrada (esquerda): circulo 12px com borda de 2px, cor neutra, fundo solido branco/card, posicionado no meio do bloco. Efeito hover que aumenta e muda cor
- Handle de saida (direita): mesmo estilo, posicionado no meio. Com um pequeno indicador visual de "arrastar daqui"
- Remover o footer "Proximo Passo" — os handles ja indicam a conexao

**Sub-itens (children):**
- Cada child com fundo levemente colorido baseado no tipo
- Separador sutil entre children
- Icone pequeno + label do tipo + conteudo em layout limpo
- Botoes de reordenacao mantidos no hover

**Card geral:**
- Borda lateral colorida (left border 4px) com a cor do primeiro child
- Sombra sutil e limpa
- Cantos arredondados suaves (12px)
- Largura fixa ~280px

### Mudancas no index.css

- Estilos para handles com transicoes suaves
- Estilo de hover nos nodes mais limpo (sem scale exagerado)

### Arquivos a alterar

1. **`src/components/chatbot/BlockNode.tsx`** — Redesign completo do componente visual
2. **`src/index.css`** — Ajustes nos estilos dos handles e nodes do React Flow

