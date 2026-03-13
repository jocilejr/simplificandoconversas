

## Correção: Execução deve respeitar conexões

### Problema
Linha 331 (`execute-flow.ts` backend) e linha 504 (edge function):
```typescript
startNodes = nodes.filter((n: any) => !targetsSet.has(n.id));
```
Qualquer nó sem conexão de entrada é tratado como ponto de partida — incluindo nós completamente desconectados. O fluxo deve ser linear: começa no trigger e segue **apenas** pelas conexões (edges).

### Correção
Em ambos os arquivos, substituir a lógica de `startNodes` por:

1. Buscar apenas nós do tipo `trigger` (ou `groupBlock` contendo trigger)
2. Se não encontrar trigger, buscar o primeiro nó sem entrada **que tenha pelo menos uma saída**
3. Nós sem nenhuma conexão (entrada ou saída) são ignorados completamente

```typescript
const sourcesSet = new Set(edges.map((e: any) => e.source));

startNodes = nodes.filter((n: any) => {
  const d = n.data || {};
  if (d.type === "trigger") return true;
  if (d.type === "groupBlock" && d.steps) {
    return d.steps.some((s: any) => s.data?.type === "trigger");
  }
  return false;
});

if (startNodes.length === 0) {
  // Fallback: primeiro nó conectado (tem saída mas não tem entrada)
  startNodes = nodes.filter((n: any) =>
    !targetsSet.has(n.id) && sourcesSet.has(n.id)
  );
  if (startNodes.length === 0 && nodes.length > 0) {
    startNodes.push(nodes[0]);
  }
}
```

### Arquivos
| Arquivo | Linhas | Mudança |
|---------|--------|---------|
| `deploy/backend/src/routes/execute-flow.ts` | 324-333 | Nova lógica de startNodes |
| `supabase/functions/execute-flow/index.ts` | 495-508 | Mesma correção |

