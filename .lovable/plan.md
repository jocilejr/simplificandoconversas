

## Plano: Aprimorar nos de Condição e Ação

Os nos de condição e ação atualmente usam o template generico (icone + label + descrição em texto). Vou dar a cada um um design visual distinto e informativo.

### Condição — Design ramificado

**StepNode (no avulso):**
- Manter o card com header, mas redesenhar o body para mostrar a regra de forma visual: pill com campo, operador e valor separados por badges coloridos
- Labels nos handles de saída: "Sim ✓" (verde) e "Não ✗" (vermelho)

**GroupNode (dentro de grupo):**
- Render customizado similar ao waitForClick: header com fundo vermelho/coral sutil, icone GitBranch
- Body mostrando a regra em formato visual: `[campo] [operador] [valor]` em badges/pills separados
- Se sem valor definido, mostrar placeholder "Configurar condição..."

### Ação — Design com badge de tipo

**StepNode (no avulso):**
- Body redesenhado: badge colorido indicando o tipo de ação (Tag, Lista, Variável) + valor ao lado
- Icone contextual: Tag para add/remove_tag, List para add_to_list, Variable para set_variable

**GroupNode (dentro de grupo):**
- Render customizado: header com fundo laranja sutil, icone Settings
- Body com badge pill colorido do tipo de ação + valor
- Icones contextuais por actionType

### Arquivos alterados

1. **`src/components/chatbot/GroupNode.tsx`** — Adicionar renders customizados para `condition` e `action` no `StepRow` (antes do fallback generico), similar ao pattern usado em `waitForClick` e `waitDelay`

2. **`src/components/chatbot/StepNode.tsx`** — Redesenhar o body section para condition e action com layout visual mais rico (pills/badges para regras e tipos de ação)

