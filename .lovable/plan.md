

## Diagnóstico Confirmado: Bug no Ciclo de Vida da Execução

### Causa Raiz (comprovada pelos dados)

**Linha 801 de `execute-flow.ts`**: após o loop `while` terminar (inclusive por `break` do waitForClick/waitForReply), o código **sempre** executa:

```typescript
await serviceClient.from("flow_executions")
  .update({ status: "completed", results: JSON.stringify(results) })
  .eq("id", executionId);
```

Isso **sobrescreve** o status `waiting_click` que foi definido na linha 600/666 durante o processamento do nó.

**Cronologia comprovada** (execução `71bb9dd4`):
1. `21:33:38` — execução criada, status `running`
2. `21:34:05` — tracked_link criado (waitForClick processado)
3. `21:34:12.986` — flow_timeout criado (2h)
4. `21:34:12.994` — **status sobrescrito para `completed`** (linha 801)
5. `21:34:22` — clique humano detectado, mas `execution.status === "completed"` → condição `if (execution?.status === "waiting_click")` falha → fluxo **não retoma**
6. Timeout expira → `check-timeouts` encontra status `completed` → "Skipping" → fluxo **não retoma pelo timeout** também

**Não é problema de rede/Traefik.** A infraestrutura está saudável. Sem colisão de rotas. Backend acessível internamente.

### Plano de Correção

#### 1. Corrigir `deploy/backend/src/routes/execute-flow.ts` (linha 801)

Antes de definir `status: "completed"`, verificar se a execução já está em estado de espera:

```typescript
// Verificar status atual antes de marcar como completed
const { data: finalCheck } = await serviceClient
  .from("flow_executions")
  .select("status")
  .eq("id", executionId)
  .single();

const waitingStatuses = ["waiting_click", "waiting_reply"];
if (finalCheck && !waitingStatuses.includes(finalCheck.status)) {
  await serviceClient.from("flow_executions")
    .update({ status: "completed", results: JSON.stringify(results) })
    .eq("id", executionId);
} else {
  // Preservar status de espera, apenas salvar results
  await serviceClient.from("flow_executions")
    .update({ results: JSON.stringify(results) })
    .eq("id", executionId);
}
```

Aplicar a mesma lógica na linha 807 (bloco catch de erro).

#### 2. Aplicar mesma correção em `supabase/functions/execute-flow/index.ts` (linhas 1223-1226 e 1234-1237)

Mesma verificação de status antes de sobrescrever para `completed`.

#### 3. Adicionar logs de diagnóstico em `link-redirect.ts`

Na seção `processClick`, logar o status encontrado da execução e o resultado da chamada de retomada para facilitar depuração futura.

### Resultado Esperado

- **Clique**: execução permanece `waiting_click` → link-redirect encontra status correto → retoma fluxo via `/api/execute-flow` com `resumeFromNodeId`
- **Timeout (não clicou)**: execução permanece `waiting_click` → check-timeouts encontra status correto → retoma via `timeout_node_id` (caminho "Se não clicou")
- **Sem wait**: execução termina normalmente como `completed`

### Ações Pós-Deploy

Rebuild do backend na VPS:
```bash
cd /root/simplificandoconversas/deploy && docker compose up -d --build backend
```

