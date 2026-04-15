

## Correção — normalizePhone duplicando o 55 para DDD 55

### Problema
Um número como `5599887766` (10 dígitos, DDD 55) tem `length >= 10 && length <= 11`, então recebe `"55"` na frente → `555599887766` (errado).

A regra correta:
- **10-11 dígitos**: é número local (DDD + telefone). Adicionar `55` na frente. **MAS** se já começa com `55`, ele já pode ser um número com country code de 12-13 dígitos que perdeu um dígito — nesse caso a lógica atual está correta, pois 10-11 dígitos que começam com 55 são DDD 55 mesmo.
- **12-13 dígitos**: já tem country code. Não mexer.

O problema real: o `"55"` do country code é adicionado cegamente. A correção é simples — verificar se o número já tem 12-13 dígitos (já normalizado) antes de tentar adicionar.

Mas o cenário do usuário é: número chega como `5599887766` (DDD 55, 10 dígitos) → deve virar `555599887766` (country code 55 + DDD 55 + número). **Isso é o comportamento correto.** O bug real deve estar em outro lugar — talvez o número já chega com `55` de country code (12 dígitos) e a função trata como 12 dígitos sem adicionar nada, mas o `displayPhone` no useLeads faz `!phone.startsWith("55")` que impede a adição.

Espera — relendo o pedido do usuário: "Se o numero tem 10/11 digitos e inicia com 55: adiciona outro 55." Isso confirma que DDD 55 com 10-11 dígitos deve ganhar o country code. O código atual já faz isso. O problema é quando o número **já tem 12-13 dígitos** e começa com 55 — aí não precisa adicionar nada. O código atual também já trata isso (só adiciona para 10-11).

Mas o `displayPhone` no `useLeads.ts` linha 42 tem `!phone.startsWith("55")` — isso **impede** a adição do 55 para DDDs que começam com 55! Isso está errado segundo a regra do usuário.

Vou alinhar todas as funções com a regra explícita do usuário:
- 10-11 dígitos → **sempre** adicionar 55 (mesmo se começa com 55, pois é DDD 55)
- 12-13 dígitos → já está correto, não adicionar nada

### Arquivos a alterar

**1. `src/lib/normalizePhone.ts`** — já está correto (adiciona 55 para 10-11 dígitos independente do prefixo). Sem mudança.

**2. `deploy/backend/src/lib/normalize-phone.ts`** — já está correto. Sem mudança.

**3. `src/lib/phoneNormalization.ts` → `normalizePhoneForMatching`** — já está correto. Sem mudança.

**4. `src/hooks/useLeads.ts` → `displayPhone`** — **BUGADO**. Linha 42 tem `!phone.startsWith("55")` que impede a normalização para DDD 55. Remover essa condição para alinhar com as outras funções.

```typescript
// DE:
if (phone.length >= 10 && phone.length <= 11 && !phone.startsWith("55"))
  phone = "55" + phone;

// PARA:
if (phone.length >= 10 && phone.length <= 11)
  phone = "55" + phone;
```

### Resumo
Apenas 1 arquivo precisa de correção: `src/hooks/useLeads.ts` na função `displayPhone`. As demais funções de normalização já seguem a regra correta.

