

# Plano: Pastas com drag-and-drop na listagem de fluxos

## Abordagem
Adicionar coluna `folder` na tabela `chatbot_flows` e reorganizar a página de listagem (`ChatbotBuilder.tsx`) com pastas no topo e drag-and-drop nativo para mover fluxos entre pastas.

## 1. Migração de banco de dados
```sql
ALTER TABLE public.chatbot_flows ADD COLUMN folder text DEFAULT null;
```

## 2. Atualizar `useChatbotFlows.ts`
- Adicionar `folder` ao tipo `ChatbotFlow`
- Incluir `folder` nos parâmetros de `updateFlow`

## 3. Reescrever listagem em `ChatbotBuilder.tsx`

### Layout
```text
┌──────────────────────────────────────────────┐
│ Fluxos Automáticos     [+ Pasta] [+ Fluxo]  │
├──────────────────────────────────────────────┤
│ 📁 Vendas (3)    📁 Suporte (2)             │  ← pastas no topo, drop targets
├──────────────────────────────────────────────┤
│ [Fluxo A ≡]  [Fluxo B ≡]  [Fluxo C ≡]  [+]│  ← fluxos sem pasta, draggable
└──────────────────────────────────────────────┘
```

### Comportamento
- **Pastas** aparecem como cards na parte superior com ícone de pasta e contagem de fluxos
- **Fluxos sem pasta** aparecem abaixo, como estão hoje
- **Arrastar fluxo** sobre uma pasta move o fluxo para dentro dela (drag-and-drop nativo HTML5)
- **Clicar numa pasta** abre a visão dos fluxos daquela pasta, com botão de voltar
- **Dentro da pasta**: mesma grid de cards atual, com possibilidade de arrastar fluxo de volta para fora (soltar fora das pastas = remover da pasta)
- **Menu de contexto da pasta**: renomear, excluir (fluxos voltam para raiz)
- **Menu de contexto do fluxo**: opção "Mover para pasta" com lista das pastas existentes
- **Dialog simples** para criar/renomear pasta (input com nome)

### Drag-and-drop
Usar API nativa do HTML5 (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) — sem biblioteca extra. Ao soltar um fluxo numa pasta, faz `updateFlow({ id, folder: nomeDaPasta })`.

## Arquivos modificados
1. **Migração SQL** — coluna `folder`
2. **`src/hooks/useChatbotFlows.ts`** — tipo + mutations
3. **`src/pages/ChatbotBuilder.tsx`** — pastas no topo, drag-and-drop, navegação pasta/raiz, dialogs

