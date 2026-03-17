

## Plano: Corrigir Pixel Meta que nunca dispara

### Causa raiz

Na função `executeNode()` (linha 172 de `execute-flow.ts`), existe um early return:

```typescript
if (nodeType === "metaPixel") return "metaPixel: handled-externally";
```

Essa função é chamada **antes** do código real de disparo do pixel (linhas 449-506). O nó `metaPixel` nunca chega ao código que faz o `fetch` para a Meta API — ele retorna imediatamente com "handled-externally".

O mesmo padrão existe para `aiAgent` (linha 170), que de fato é tratado em outro lugar. Mas o `metaPixel` **não é tratado em nenhum outro lugar** — o código de disparo está no bloco principal do router (linhas 449+), que só é alcançado se `executeNode()` não fizer o return antecipado.

### Correção

**`deploy/backend/src/routes/execute-flow.ts`** — Remover a linha 172:

```diff
  if (nodeType === "aiAgent") return "aiAgent: handled-externally";
-
-  if (nodeType === "metaPixel") return "metaPixel: handled-externally";

  return `${nodeType}: no-op`;
```

Isso fará com que `executeNode()` retorne `"metaPixel: no-op"` e o fluxo principal continuará até o bloco `else if (nodeType === "metaPixel")` na linha 449, onde o disparo real acontece.

### Impacto
- Correção de 1 linha
- Sem efeitos colaterais — o código de disparo já existe e está correto
- Após o fix, os logs do container devem mostrar `[execute-flow] metaPixel response:` confirmando o disparo

