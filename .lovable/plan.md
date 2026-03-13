

## Correção: Erro de compilação `activeInstances`

O problema é simples: na linha 561, o código usa `activeInstances` que não existe nesse escopo. A variável correta é `instancesToSync` (array de strings com nomes das instâncias, definida na linha 300).

### Mudança

**Arquivo:** `deploy/backend/src/routes/whatsapp-proxy.ts`

Linha 561: trocar `for (const inst of activeInstances)` por `for (const instName of instancesToSync)` e remover a linha 562 (`const instName = inst.instance_name;`) já que `instancesToSync` já contém strings com os nomes.

