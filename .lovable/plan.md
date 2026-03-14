

## Corrigir: Pausa de fluxo não interrompe envio de mensagens

### Problema identificado

O motor de execução (`execute-flow.ts`) tem **dois pontos cegos** para cancelamento:

1. **Verificação a cada 3 nós**: A checagem de status `cancelled` só ocorre quando `nodeIndex % 3 === 0` (linha 366). Entre as verificações, o fluxo continua enviando mensagens normalmente.

2. **Dentro de grupos**: O loop interno de `groupBlock` (linhas 522-580) itera por todos os steps **sem nenhuma verificação de cancelamento**. Se o grupo tem 5 mensagens, todas serão enviadas mesmo após o comando de pausa.

### Correção

**Arquivo: `deploy/backend/src/routes/execute-flow.ts`**

1. **Checar cancelamento em TODOS os nós** — remover a condição `nodeIndex % 3 === 0`, verificando status a cada nó processado (exceto o primeiro):

```typescript
// ANTES (linha 366)
if (nodeIndex > 0 && nodeIndex % 3 === 0) {

// DEPOIS
if (nodeIndex > 0) {
```

2. **Adicionar verificação de cancelamento dentro do loop de grupo** — antes de cada step interno do `groupBlock`, consultar o status da execução:

```typescript
// Dentro do for loop de group steps (antes de executar cada step)
const { data: groupStatusCheck } = await serviceClient
  .from("flow_executions").select("status").eq("id", executionId).single();
if (groupStatusCheck?.status === "cancelled" || groupStatusCheck?.status === "paused") {
  results.push(`group: ${groupStatusCheck.status} at step ${si}`);
  groupPaused = true;
  break;
}
```

### Resultado esperado
- Ao clicar "Parar" na extensão, o status é setado para `cancelled` no banco
- Na próxima iteração do loop (seja nó ou step de grupo), o motor detecta e interrompe imediatamente
- Latência máxima de parada: tempo de 1 envio de mensagem (~1-2s), em vez de potencialmente N mensagens

### Após deploy
```bash
cd /opt/chatbot/deploy && docker compose build backend && docker compose up -d --force-recreate backend
```

