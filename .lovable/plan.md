

## Bug: Fluxo responde pela instância errada

### Causa raiz

Quando o webhook recebe uma mensagem na instância "FunilPrincipal" e dispara um fluxo, o `execute-flow` **ignora a instância de origem** e usa `profile.evolution_instance_name` (a instância padrão/ativa do perfil — "Meire Rosana - Entregas") para enviar todas as mensagens do fluxo.

O problema está em dois pontos:

1. **`evolution-webhook/index.ts`** — `checkAndTriggerFlows` e `checkAndResumeWaitingReply` não passam o `instance` (nome da instância que recebeu a mensagem) para o `execute-flow`.

2. **`execute-flow/index.ts`** — Não aceita um parâmetro `instanceName` no body; sempre lê `profile.evolution_instance_name`.

### Solução

**`evolution-webhook/index.ts`** (2 alterações):
- Em `checkAndTriggerFlows`: adicionar `instanceName: instance` no body do fetch para `execute-flow`.
- Em `checkAndResumeWaitingReply`: adicionar parâmetro `instanceName` e passá-lo no fetch. Atualizar a chamada para incluir o `instance`.

**`execute-flow/index.ts`** (1 alteração):
- Ler `instanceName` do body da request.
- Se fornecido, usar esse valor em vez de `profile.evolution_instance_name` para enviar mensagens e salvar conversas.
- Manter o fallback para `profile.evolution_instance_name` quando não fornecido (execução manual pelo usuário).

```text
Webhook recebe msg na instância "FunilPrincipal"
  → checkAndTriggerFlows(..., instance="FunilPrincipal")
    → fetch execute-flow { instanceName: "FunilPrincipal" }
      → execute-flow usa "FunilPrincipal" para enviar (não mais o padrão do perfil)
```

### Arquivos alterados
- `supabase/functions/evolution-webhook/index.ts` — passar `instanceName` nas chamadas ao execute-flow
- `supabase/functions/execute-flow/index.ts` — aceitar e usar `instanceName` do body

