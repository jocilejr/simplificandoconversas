
Diagnóstico rápido: o “Pixel Meta” foi adicionado no `NodePalette.tsx`, mas esse componente não é usado no editor atual. A tela do seu print usa os menus internos de `FlowEditor.tsx` (“Adicionar Nó” e menu de clique direito), e nesses dois pontos o `metaPixel` não foi incluído — por isso “não tem”.

Plano de correção

1) Unificar as categorias de nós em uma única fonte
- Criar um array compartilhado de categorias/tipos (ex.: em `src/types/chatbot.ts`), incluindo:
  - Gatilhos, Mensagens, Lógica, Ações, Inteligência Artificial, Rastreamento
  - `metaPixel` em “Rastreamento”
  - garantir `sendFile` também em todos os menus
- Benefício: evita divergência entre menus (foi exatamente o bug atual).

2) Corrigir `FlowEditor.tsx` (pontos realmente visíveis no builder)
- Substituir os dois arrays hardcoded por esse array compartilhado:
  - menu do botão **“Adicionar Nó”** (topo direito)
  - menu de **clique direito** no canvas
- Resultado esperado: categoria “Rastreamento” e item “Pixel Meta” aparecem em ambos.

3) Corrigir adição dentro de grupos (`GroupNode.tsx`)
- Incluir `metaPixel` em `allAddableTypes` do botão “Adicionar ação” do bloco de grupo.
- Resultado esperado: também dá para inserir Pixel Meta dentro de grupo (o backend já processa esse caso).

4) Ajuste visual de preview (`StepNode.tsx`)
- Adicionar descrição para `metaPixel` no `renderDescription` (ex.: evento + valor/moeda quando existir), para ficar legível no card do nó.

Validação (checklist)
- Abrir fluxo e clicar **Adicionar Nó**: deve aparecer seção **Rastreamento > Pixel Meta**.
- Clicar com botão direito no canvas: deve aparecer **Pixel Meta** também.
- Dentro de um grupo, “Adicionar ação”: deve permitir **Pixel Meta**.
- Salvar, sair e reabrir o fluxo: nó continua presente e configurado.

Se ainda não aparecer após deploy
- Fazer hard refresh (Ctrl+Shift+R).
- Confirmar build novo no servidor:
  - `grep -R "Rastreamento" deploy/frontend`
  - `grep -R "metaPixel" deploy/frontend`
- Se grep não retornar, o frontend publicado ainda está com build antigo.
