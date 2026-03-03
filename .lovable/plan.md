

## Blocos Estilo Botconversa — Nós Empilhados com Conexão Única

### Referência Visual
A imagem mostra blocos do Botconversa onde múltiplos sub-nós (mensagem de texto, delay, etc.) são empilhados verticalmente dentro de um único cartão container. Cada bloco tem:
- Um **header** com título (ex: "WhatsApp - Enviar Mensagem")
- Sub-itens empilhados sem espaço (delay inline, texto, links)
- Apenas **uma entrada** (handle esquerdo no topo do bloco)
- Apenas **uma saída** ("Próximo Passo" no rodapé do último nó)

### Abordagem

Em vez de usar nós individuais do React Flow que se "encaixam", vou criar um **BlockNode** — um único nó do React Flow que contém internamente uma lista de sub-nós empilhados. Isso resolve vários problemas:
- Handles de entrada/saída aparecem apenas uma vez por bloco
- Sub-nós se movem juntos automaticamente (são um só nó)
- Visual limpo e profissional igual ao Botconversa

### O que será feito

**1. Novo tipo de nó `BlockNode`**
- Um nó React Flow que renderiza internamente N sub-itens empilhados
- Header verde com "WhatsApp - Enviar Mensagem" (ou título do tipo)
- Cada sub-item mostra seu conteúdo (texto formatado, delay, etc.)
- Handle de entrada (esquerdo) apenas no topo
- Handle de saída (direito) com label "Próximo Passo" apenas no rodapé

**2. Dados do bloco em `FlowNodeData`**
- Novo campo `children: FlowNodeData[]` para armazenar sub-nós dentro do bloco
- Ao arrastar um nó sobre um bloco existente, ele é adicionado como filho
- Ao arrastar para o canvas vazio, cria um bloco com 1 item

**3. Interações**
- Arrastar nó da paleta sobre bloco existente → adiciona como sub-item
- Arrastar nó da paleta no canvas vazio → cria novo bloco
- Clicar em sub-item dentro do bloco → abre PropertiesPanel para editar
- Reordenar sub-itens dentro do bloco via drag interno (opcional, simplificado)
- Botão de remover sub-item individual

**4. Visual estilo Botconversa**
- Container branco/card com sombra suave e borda arredondada
- Header colorido por tipo do primeiro nó
- Sub-itens separados por bordas sutis
- Rodapé "Próximo Passo" com ícone de seta e handle de saída
- Nós de delay aparecem como badges inline (ex: "⏳ Aguardando por 5 segundos...")

### Arquivos afetados

- `src/types/chatbot.ts` — adicionar campo `children` ao `FlowNodeData`
- `src/components/chatbot/BlockNode.tsx` — novo componente que renderiza o bloco empilhado
- `src/components/chatbot/CustomNode.tsx` — simplificado ou removido (blocos substituem nós individuais)
- `src/components/chatbot/FlowEditor.tsx` — lógica de drop (sobre bloco = adicionar filho, canvas = novo bloco), registrar BlockNode nos nodeTypes
- `src/components/chatbot/PropertiesPanel.tsx` — suportar edição de sub-item selecionado dentro de um bloco
- `src/components/chatbot/NodePalette.tsx` — sem mudanças significativas

