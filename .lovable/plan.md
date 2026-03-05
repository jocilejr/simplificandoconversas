

## Bug: Timeout não funciona para waitForClick dentro de groupBlock

### Causa raiz

O código de inserção de timeout na tabela `flow_timeouts` (linhas 480-496) só existe no handler de nós **standalone** `waitForClick`. Quando o `waitForClick` está dentro de um **groupBlock** (linhas 535-609), o fluxo é pausado corretamente (status `waiting_click`), mas **nenhum timeout é criado**. Por isso o `check-timeouts` nunca encontra nada para processar e o fluxo fica preso para sempre.

Confirmação: a query `SELECT * FROM flow_timeouts` retorna vazio, mesmo com a execução em `waiting_click` há mais de 20 segundos.

### Solução

Adicionar a lógica de inserção de timeout dentro do handler de `waitForClick` no groupBlock (após a linha 605), replicando a mesma lógica que já existe no handler standalone (linhas 480-496).

**Arquivo: `supabase/functions/execute-flow/index.ts`** — Após a linha 605 (onde marca `waiting_click` no groupBlock), inserir:

```typescript
// Insert timeout if configured (inside group)
const clickTimeout = step.data.clickTimeout || 0;
if (clickTimeout > 0) {
  const timeoutNodeId = timeoutEdgeMap.get(node.id) || null;
  const unit = step.data.clickTimeoutUnit || "minutes";
  const multiplier = unit === "seconds" ? 1000 : unit === "hours" ? 3600000 : 60000;
  const timeoutAt = new Date(Date.now() + clickTimeout * multiplier).toISOString();
  await serviceClient.from("flow_timeouts").insert({
    execution_id: executionId,
    flow_id: flowId,
    user_id: userId,
    remote_jid: jid,
    conversation_id: conversationId || null,
    timeout_node_id: timeoutNodeId,
    timeout_at: timeoutAt,
  });
  console.log(`[execute-flow] Timeout set for group waitForClick: ${timeoutAt} -> node ${timeoutNodeId || '(end flow)'}`);
}
```

O mesmo problema pode existir para `waitForReply` dentro de groups, mas no fluxo atual o `waitForReply` parece estar em grupo e ter timeout 0 — mesmo assim, seria prudente adicionar a mesma lógica para consistência futura.

### Arquivos alterados
- `supabase/functions/execute-flow/index.ts` — adicionar inserção de timeout para waitForClick (e opcionalmente waitForReply) dentro de groupBlock

