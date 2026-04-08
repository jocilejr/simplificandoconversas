

# Corrigir: primeira mensagem deve aguardar o delay

## Problema
Na `processNext()` (linha 64-91), o delay acontece **depois** do envio. Isso significa que a primeira mensagem é enviada imediatamente, sem respeitar o delay configurado. O delay só se aplica entre a 1a e a 2a mensagem.

## Solução
Mover o delay para **antes** do envio na `processNext()`. Assim toda mensagem — incluindo a primeira — aguarda o delay configurado antes de ser enviada.

### Arquivo: `deploy/backend/src/lib/message-queue.ts`

Reordenar a lógica de `processNext()`:

```text
1. Pegar item da fila
2. AGUARDAR delay (ou cooldown se atingiu o limite)
3. Só então executar o envio
4. Incrementar sendCount
5. Processar próximo
```

Mudança concreta na função `processNext()`:
- Mover o bloco de `await new Promise(setTimeout)` para **antes** do `await item.fn()`
- Manter o check de cooldown antes do delay normal
- Log indicando "waiting Xms before sending..."

## Deploy
```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

