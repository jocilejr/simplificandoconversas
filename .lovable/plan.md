

## Handles de Conexão Invisíveis

O problema é que os handles (pontos de conexão) existem no código, mas são praticamente invisíveis porque usam `!bg-card` — mesma cor do fundo do bloco. Além disso, são pequenos (12px) e difíceis de encontrar.

### Solução

Redesenhar os handles para serem visíveis e intuitivos:

**`src/components/chatbot/BlockNode.tsx`**:
- **Handle de entrada (esquerdo):** Mudar para um círculo visível com borda colorida e fundo semi-transparente, posicionado no meio vertical do bloco
- **Handle de saída (direito):** Mesmo estilo, posicionado no footer "Próximo Passo" — mover o handle para ficar alinhado com o texto/seta do footer
- Aumentar tamanho dos handles para ~14-16px
- Usar cores visíveis: borda `primary` ou cor do header, fundo semi-transparente
- Adicionar efeito hover mais evidente (scale + cor mais forte)

### Arquivo a alterar

1. **`src/components/chatbot/BlockNode.tsx`** — Estilos dos dois handles (target left, source right)

