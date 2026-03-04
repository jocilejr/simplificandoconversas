

## Problema

O botão "Adicionar Nó" no `FlowEditor.tsx` (linha 657-661) usa uma lista de categorias **hardcoded** que não inclui a categoria "Inteligência Artificial" com o tipo `aiAgent`. O componente `NodePalette.tsx` tem essa categoria, mas não é utilizado — o FlowEditor renderiza seu próprio popover inline.

## Solução

Adicionar a categoria "Inteligência Artificial" com o tipo `aiAgent` à lista inline no `FlowEditor.tsx`, na linha 661, logo após a categoria "Ações":

```typescript
{ label: "Ações", types: ["action"] as FlowNodeType[] },
{ label: "Inteligência Artificial", types: ["aiAgent"] as FlowNodeType[] },
```

Isso é uma mudança de **1 linha** que torna o nó Agente IA acessível no menu "Adicionar Nó".

### Arquivos a editar

1. **`src/components/chatbot/FlowEditor.tsx`** — Adicionar `{ label: "Inteligência Artificial", types: ["aiAgent"] as FlowNodeType[] }` na lista de categorias do popover (após linha 661).

