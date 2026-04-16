

# Plano: Auto-retry de jobs com falha (10s delay, máx 5 tentativas)

## Problema
Quando o `dispatchJob` falha (ex: Evolution API offline durante deploy), o job é marcado como `failed` imediatamente sem nenhuma tentativa de retry. Falhas momentâneas ficam permanentes.

## Correção

### Arquivo: `deploy/backend/src/routes/followup-daily.ts`

Alterar o bloco `.then()/.catch()` do `queue.enqueue()` (linhas 867-907) para implementar retry inline:

**Lógica:**
1. Envolver o `dispatchJob` em um loop de retry com máximo de 5 tentativas
2. A cada falha, aguardar 10 segundos antes de tentar novamente
3. Atualizar `attempts` no banco a cada tentativa
4. Só marcar como `failed` definitivamente após esgotar as 5 tentativas
5. Se conseguir na retry, marcar como `sent` normalmente

**Pseudocódigo da alteração:**
```typescript
queue.enqueue(async () => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 10_000;
  let lastError: string = "";
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await dispatchJob({ ...job, normalized_phone: normalizedPhone }, context.delayMs);
      return; // success — exit loop
    } catch (err: any) {
      lastError = err?.message?.slice(0, 500) || "Falha desconhecida";
      console.warn(`[followup-daily] ⚠️ Attempt ${attempt}/${MAX_RETRIES} failed for ${job.transaction_id}: ${lastError}`);
      
      if (attempt < MAX_RETRIES) {
        // Update attempts count in DB
        await markQueueJob(sb, job.id, {
          attempts: attempt + (job.attempts || 0),
          last_error: `Tentativa ${attempt}/${MAX_RETRIES}: ${lastError}`,
        });
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  // All retries exhausted — throw to trigger the catch handler
  throw new Error(lastError);
}, ...)
```

O `.then()` e `.catch()` externos permanecem iguais — o `.catch()` só será acionado se todas as 5 tentativas falharem.

### Frontend — sem alterações
A lógica de status no frontend já trata `failed` corretamente após a correção anterior.

### Deploy
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

## Resultado esperado
- Falhas momentâneas (deploy, rede) são recuperadas automaticamente em ~10-50s
- O log mostra cada tentativa com `⚠️ Attempt X/5`
- Só marca `failed` definitivamente após 5 tentativas falhadas
- Nenhum impacto em jobs que já funcionam normalmente

