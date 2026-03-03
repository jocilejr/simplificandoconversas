

## Redesign Visual Completo — Inspirado no ManyChat Moderno

Analisando a screenshot, os problemas principais sao: blocos escuros demais sem contraste, handles invisíveis, header sem destaque, children sem hierarquia visual clara, e falta de "polish" geral.

### Proposta de Design

**1. Trigger Node (Gatilho)**
- Card compacto com fundo gradiente verde suave (nao solido saturado)
- Borda arredondada 16px, sombra com glow verde sutil
- Icone em circulo branco, texto branco bold
- Handle de saida: circulo branco com borda verde, 16px, com seta indicando direcao

**2. Block Node (Blocos regulares)**
- Fundo `bg-card` com bordas arredondadas 16px
- Header com fundo da cor do tipo em opacidade 8%, com barra superior colorida de 3px (top border, nao left)
- Icone em circulo com fundo colorido + label em bold
- Sombra: `shadow-md` no default, `shadow-xl + ring` no selected
- Largura: manter 280px

**3. Children (sub-itens)**
- Cada child como "mini-card" com padding maior, fundo `bg-muted/20` no hover
- Icone colorido circular + label em uppercase 10px + conteudo abaixo
- Separador: linha fina pontilhada entre children
- Delay: pill centralizada mais estilizada

**4. Handles de Conexao — Visibilidade Total**
- Tamanho: 16px com borda de 3px
- Cor default: borda `border` + fundo branco (light) / fundo card (dark)
- Hover: borda `primary`, fundo `primary/20`, scale 1.2, glow ring
- Target (esquerda): centralizado verticalmente
- Source (direita): centralizado verticalmente
- Adicionar um pequeno circulo interno de 4px com cor primary para indicar que e clicavel

**5. Edges (conexoes)**
- Tipo `smoothstep`, cor `primary/60`, strokeWidth 2
- Animated com dash pattern sutil
- Hover: cor `primary` solida, strokeWidth 3

**6. CSS Global (index.css)**
- Handles com transitions, glow effect, inner dot
- Nodes com hover shadow suave
- Edge hover styles
- Melhor contraste geral no dark mode

### Arquivos a alterar

1. **`src/components/chatbot/BlockNode.tsx`** — Redesign completo do visual dos blocos e handles
2. **`src/index.css`** — Handles, edges, e node hover styles redesenhados

