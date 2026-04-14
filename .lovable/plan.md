

## Diagnóstico

O número `55999229423` tem **DDD 55** (região do RS) + `999229423`. O sistema confunde o DDD "55" com o código do país "55" e não adiciona o prefixo internacional, resultando em 11 dígitos. A validação exige mínimo 12 dígitos → falha.

## Correção

A regra correta: **todo número de 10-11 dígitos é local brasileiro** (DDD + assinante) e SEMPRE precisa do prefixo "55". Não importa se começa com "55" — nesse comprimento é impossível já ter código de país.

### Arquivos a alterar

**1. `deploy/backend/src/lib/normalize-phone.ts`** (backend — o que causou a falha)
- Remover a condição `!phone.startsWith("55")`
- Números de 10-11 dígitos sempre recebem prefixo "55"

**2. `src/lib/normalizePhone.ts`** (frontend — mesmo bug)
- Mesma correção: remover `!phone.startsWith("55")`

**3. `src/lib/phoneNormalization.ts`** — já está correto em `normalizePhoneForMatching`, mas a função `generatePhoneVariations` tem lógica que assume `startsWith('55')` = código de país quando o número tem 12+ dígitos, o que está OK pois nesse ponto já teria 12-13 dígitos (já com país).

### Resultado esperado

- Input: `55999229423` (11 dígitos, DDD 55)
- Antes: `55999229423` (11 dígitos → rejeitado)
- Depois: `5555999229423` (13 dígitos → enviado com sucesso)

### Após o deploy

Será necessário reprocessar as transações pendentes desse número na VPS para que a recuperação seja enviada.

