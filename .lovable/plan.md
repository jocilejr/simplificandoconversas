

## Plano: Nó Meta Pixel com value/currency dinâmicos

O plano anterior está correto, mas o payload da Conversions API deve usar os valores configurados no nó do fluxo — sem nada hardcodado.

### Mudanças

**1. Migração SQL** — adicionar `meta_pixel_id` e `meta_access_token` à tabela `profiles`

**2. `src/types/chatbot.ts`** — novo tipo `metaPixel` com campos:
- `pixelEventName`: select (Lead, Purchase, CompleteRegistration, ViewContent, InitiateCheckout, Subscribe, Contact, Custom)
- `pixelCustomEventName`: string (quando Custom)
- `pixelEventValue`: number (opcional, definido pelo usuário no fluxo)
- `pixelCurrency`: string (default "BRL", editável no fluxo)

**3. `src/components/chatbot/PropertiesPanel.tsx`** — campos do nó:
- Select de evento
- Input de nome custom (condicional)
- Input numérico de valor (R$)
- Input de moeda (default BRL)

**4. `src/components/chatbot/NodePalette.tsx`** — adicionar na categoria "Rastreamento"

**5. `deploy/backend/src/routes/execute-flow.ts`**:
- Query de profile inclui `meta_pixel_id, meta_access_token`
- Handler `metaPixel` no `executeStep`:
```ts
const eventName = step.pixelCustomEventName || step.pixelEventName || "Lead";
const customData: any = {};
if (step.pixelEventValue) customData.value = step.pixelEventValue;
if (step.pixelCurrency) customData.currency = step.pixelCurrency;

// POST graph.facebook.com/v21.0/{pixel_id}/events
// data[0].custom_data = customData (só inclui se tiver value)
```
Ou seja: `value` e `currency` vêm diretamente do que o usuário configurou no nó do fluxo. Se não preencheu valor, `custom_data` fica vazio.

**6. `src/components/settings/AppSection.tsx`** — inputs Pixel ID e Access Token

**7. `src/hooks/useProfile.ts`** — incluir campos no mutation

### Arquivos impactados
| Arquivo | Mudança |
|---------|---------|
| Migração SQL | +2 colunas em `profiles` |
| `src/types/chatbot.ts` | Tipo `metaPixel` + campos |
| `PropertiesPanel.tsx` | UI do nó |
| `NodePalette.tsx` | Categoria Rastreamento |
| `execute-flow.ts` | Handler + query profile |
| `AppSection.tsx` | Inputs credenciais Meta |
| `useProfile.ts` | Campos no mutation |

