

## Diagnóstico: Follow Up para antes de finalizar os envios

### Problemas identificados

Analisei o fluxo completo: cron → `processFollowUpDaily()` → `MessageQueue.processNext()` e encontrei **3 causas potenciais**:

**1. Fetch sem timeout (causa mais provável)**
As chamadas `fetch()` para a Evolution API (sendText, sendMedia) não têm timeout. Se a Evolution demorar ou travar, o `await fetch(...)` fica preso **indefinidamente**, bloqueando a fila inteira. Nenhuma mensagem seguinte é processada.

**2. Cadeia recursiva sem proteção**
O método `processNext()` chama a si mesmo recursivamente (linha 135) sem `await` e sem `.catch()`. Se ocorrer uma exceção não capturada antes do `try/catch` interno (ex: durante o cooldown), a cadeia de processamento **morre silenciosamente** — a fila fica com itens mas `processing = false` nunca é resetado corretamente.

**3. Cooldown legítimo confundido com parada**
Se `pause_after_sends` está configurado (ex: 5), após 5 envios a fila pausa por `pause_minutes` minutos. Isso é comportamento correto, mas pode parecer que "parou".

### Correções

**1. Adicionar timeout nas chamadas fetch (`deploy/backend/src/routes/followup-daily.ts`)**
Criar helper com `AbortController` e timeout de 30s para todas as chamadas à Evolution API:

```typescript
async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```

Substituir todos os `fetch(...)` por `fetchWithTimeout(...)`.

**2. Proteger a cadeia recursiva (`deploy/backend/src/lib/message-queue.ts`)**
Envolver `processNext()` em try/catch global e garantir que a cadeia nunca morra:

```typescript
private async processNext() {
  if (this.queue.length === 0) {
    this.processing = false;
    this.currentLabel = null;
    return;
  }
  this.processing = true;
  // ... existing logic ...
  
  // Protect recursive call
  try {
    this.processNext();
  } catch (e) {
    console.error(`[queue:${this.instanceName}] processNext chain error, retrying...`, e);
    setTimeout(() => this.processNext(), 1000);
  }
}
```

**3. Adicionar log de progresso com total**
Para facilitar a investigação futura, adicionar contadores de progresso nos logs:

```
[followup-daily] Progress: 15/42 enqueued, 8 skipped
```

### Verificação na VPS

Antes da correção, rode na VPS para ver se a fila está travada:

```bash
cd ~/simplificandoconversas/deploy
curl -s http://localhost:3100/api/queue-status | python3 -m json.tool
```

Isso mostra se há itens na fila, se está em cooldown, e o histórico de envios (sent/failed).

Também verifique os logs do backend:

```bash
docker compose logs --tail=200 backend | grep -E "followup-daily|queue:"
```

### Resultado esperado
- Fetch com timeout de 30s impede que a fila trave em chamadas penduradas
- Cadeia recursiva protegida garante que a fila sempre continue processando
- Logs de progresso facilitam investigação futura

