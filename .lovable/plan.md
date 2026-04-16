

# Plano: Anti-duplicação simples — marcar e travar

## Problema
O `fireMessage` insere itens na fila e chama `queue/process`. Quando múltiplas publicações disparam ao mesmo tempo, cada uma chama `queue/process` em paralelo. Sem lock, duas chamadas pegam os mesmos itens `pending` e enviam duas vezes.

## Solução (2 mudanças cirúrgicas)

### 1. `queue/process` — Marcar tudo como `processing` em batch ANTES do loop

**Arquivo:** `deploy/backend/src/routes/groups-api.ts` (linhas 1154-1164)

Após buscar os itens `pending`, imediatamente marcar todos como `processing` com um único UPDATE antes de iniciar o loop de envio. Assim, uma segunda chamada paralela ao `queue/process` não vê esses itens.

```typescript
// Após buscar pending (linha 1164):
const pendingIds = pending.map(p => p.id);
await sb.from("group_message_queue")
  .update({ status: "processing", started_at: new Date().toISOString() })
  .in("id", pendingIds);
```

Remover a linha 1250 que marca `processing` individual dentro do loop (já foi feito em batch).

### 2. `fireMessage` — Debounce de 2s no `queue/process`

**Arquivo:** `deploy/backend/src/lib/group-scheduler.ts`

Adicionar um `Map<string, NodeJS.Timeout>` no `GroupSchedulerManager`. Em vez de cada `fireMessage` chamar `queue/process` imediatamente (linha 484), usar debounce: se já existe um timer pendente para aquele workspace, resetar. Após 2s sem novo disparo, aí sim chama `queue/process` uma única vez.

```typescript
private processDebounce = new Map<string, NodeJS.Timeout>();

private triggerQueueProcess(workspaceId: string): void {
  const existing = this.processDebounce.get(workspaceId);
  if (existing) clearTimeout(existing);
  
  const timer = setTimeout(async () => {
    this.processDebounce.delete(workspaceId);
    const port = process.env.PORT || "3001";
    await fetch(`http://localhost:${port}/api/groups/queue/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
  }, 2000);
  this.processDebounce.set(workspaceId, timer);
}
```

Substituir o bloco `fetch queue/process` (linhas 482-512) por uma chamada a `this.triggerQueueProcess(campaign.workspace_id)`.

### 3. Remover dedup redundante do `queue/process`

**Arquivo:** `deploy/backend/src/routes/groups-api.ts` (linhas 1176-1212)

Remover o bloco inteiro de deduplicação dentro do loop do `queue/process`. Ele já não é necessário porque:
- O batch mark `processing` impede processamento paralelo
- O debounce impede chamadas paralelas
- O item foi inserido apenas 1 vez pelo `fireMessage`

O loop fica limpo: busca pending → marca processing em batch → envia 1 a 1 com delay → marca sent/failed.

## Resultado
- Cada publicação entra na fila 1 vez por grupo
- `queue/process` marca tudo como `processing` atomicamente antes de enviar
- Respeita o delay entre envios
- Marca `sent` ou `failed` — item travado, nunca reenviado

## Validação
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
docker logs deploy-backend-1 --since=5m 2>&1 | grep -i "\[scheduler\]\|\[groups-queue\]" | tail -40
```

