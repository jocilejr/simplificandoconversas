

## Bug: Fluxo permanece ativo após timeout quando saída de timeout não está conectada

### Causa raiz

No `execute-flow`, o timeout só é registrado na tabela `flow_timeouts` quando existe um nó conectado à saída de timeout (`output-1`). Se a saída "Se não clicou" não está conectada a nada, **nenhum timeout é criado**, e a execução fica presa com status `waiting_click` para sempre.

Código atual (linhas 480-497):
```javascript
if (clickTimeout > 0) {
  const timeoutNodeId = timeoutEdgeMap.get(node.id);
  if (timeoutNodeId) {  // ← só cria timeout se tiver nó conectado
    // ...insert timeout
  }
}
```

### Solução

Dois arquivos precisam de alteração:

**1. `supabase/functions/execute-flow/index.ts`** — Registrar timeout mesmo sem nó conectado:
- No `waitForClick` (linha ~482): remover a condição `if (timeoutNodeId)` e inserir o timeout com `timeout_node_id: timeoutNodeId || null`
- No `waitForReply` (linha ~514): mesma alteração

**2. `supabase/functions/check-timeouts/index.ts`** — Tratar timeout sem nó de destino:
- Quando `timeout_node_id` é `null`, apenas marcar a execução como `completed` e o timeout como `processed`, sem chamar `execute-flow` para retomar

```text
Antes:
  timeout=20s + sem conexão → nenhum timeout criado → fluxo preso em waiting_click

Depois:
  timeout=20s + sem conexão → timeout criado com node_id=null → check-timeouts completa a execução
```

### Arquivos alterados
- `supabase/functions/execute-flow/index.ts` — inserir timeout independente de haver nó conectado
- `supabase/functions/check-timeouts/index.ts` — completar execução quando `timeout_node_id` é null

