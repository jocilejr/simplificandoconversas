

## Problema

Erro de compilação TypeScript: `resolvedPhone` é usado como shorthand property na linha 420, mas não existe no escopo da função `checkAndTriggerFlows`. A variável `resolvedPhone` existe no handler do router (escopo externo), mas não é passada como parâmetro para a função.

## Correção

### `deploy/backend/src/routes/webhook.ts`

1. **Linha 356**: Adicionar `resolvedPhone: string | null` como parâmetro da função `checkAndTriggerFlows`
2. **Chamadas à função** (provavelmente linhas ~340): Passar `resolvedPhone` como argumento na chamada

Mudança mínima — apenas adicionar o parâmetro que falta na assinatura da função e garantir que a chamada passa o valor.

