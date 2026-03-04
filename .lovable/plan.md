

## Plano: Refazer GroupNode profissional + corrigir tipo reservado

### Problema raiz
O tipo de nó `"group"` é **reservado pelo React Flow** — ele aplica automaticamente estilos de container (fundo branco, padding, z-index especial) que sobrescrevem qualquer CSS. Por isso todas as tentativas anteriores falharam. Nenhuma quantidade de `!important` resolve isso porque o React Flow trata `group` como um tipo interno especial.

### Solução

#### 1. Renomear tipo `"group"` → `"groupBlock"` em todo o projeto
Isso elimina o conflito com o tipo reservado do React Flow.

**Arquivos afetados:**
- `src/types/chatbot.ts` — union type e configs
- `src/components/chatbot/FlowEditor.tsx` — nodeTypes, comparações, atribuições + migração de dados salvos
- `src/components/chatbot/PropertiesPanel.tsx` — comparação
- `supabase/functions/execute-flow/index.ts` — comparação
- `supabase/functions/evolution-webhook/index.ts` — comparação
- `src/index.css` — seletor CSS `.react-flow__node-group` → `.react-flow__node-groupBlock`

#### 2. Redesenhar GroupNode para ficar igual à referência

Baseado na imagem de referência, o design será:
- Card escuro arredondado (`rounded-xl`) sem overflow artifacts
- Header: ícone verde circular + título do grupo + ícone de check
- Handle de entrada (verde) no topo esquerdo, handle de saída no topo direito
- Steps como linhas compactas com ícone colorido + nome + descrição curta, cada uma num mini-card escuro
- Footer: botão "+ Adicionar ação" centralizado
- Sem barra lateral de cor, sem footer com "Próximo Passo"

#### 3. Migração automática de dados salvos
No `FlowEditor.tsx`, adicionar conversão de nós com `type: "group"` para `type: "groupBlock"` ao carregar.

