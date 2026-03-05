

## Bug: `checkAndResumeWaitingReply` não é encontrada — erro de escopo

### Causa raiz

O log confirma: `ReferenceError: checkAndResumeWaitingReply is not defined`. A função `checkAndResumeWaitingReply` está **dentro** de `checkAndTriggerFlows` por causa de uma chave `}` faltando. A linha 383 fecha o `for` loop, mas não fecha a função `checkAndTriggerFlows`. Resultado: `checkAndResumeWaitingReply` é uma função local inacessível do escopo principal.

### Solução

**Arquivo: `supabase/functions/evolution-webhook/index.ts`** — Adicionar `}` na linha 383 para fechar a função `checkAndTriggerFlows` antes da definição de `checkAndResumeWaitingReply`:

```
}  // fecha for loop
}  // fecha checkAndTriggerFlows

async function checkAndResumeWaitingReply(...)
```

### Arquivos alterados
- `supabase/functions/evolution-webhook/index.ts` — corrigir escopo da função

