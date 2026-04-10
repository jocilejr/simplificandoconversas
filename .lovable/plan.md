## Corrigir geração de URL — Buscar telefone existente em `member_products` antes de gerar

**Problema**: Ao digitar `89981340810` na Entrega Digital, o `normalizePhone` transforma para `558981340810`. Mas no banco `member_products` o telefone pode estar como `5589981340810`. Isso gera URLs inconsistentes e pode duplicar registros.

**Regra de matching** (prioridade):

1. Número exato (após limpar caracteres não numéricos) = match
2. Número sem o 9 após DDD (após limpar caracteres não numéricos) (se 13 dígitos) = match
3. Número com o 9 após DDD (após limpar caracteres não numéricos) (se 12 dígitos) = match
4. Últimos 8 dígitos iguais (após limpar caracteres não numéricos) = match
5. Se nada bater = criar nova entrada

**Importante**: O campo de telefone digitado sempre será limpo (remover espaços, símbolos, não-dígitos) antes de aplicar as regras.

---

### 1. Nova função `findExistingMemberPhone` em `src/lib/phoneNormalization.ts`

Recebe um array de registros `member_products` (com `phone`, `is_active`, `product_id`) e o telefone digitado (já limpo). Aplica as 4 regras de matching em ordem de prioridade. Retorna o `phone` já salvo no banco ou `null`.

```typescript
export function findExistingMemberPhone(
  members: Array<{ phone: string; is_active: boolean; product_id: string }>,
  inputPhone: string,
  productId: string
): string | null {
  const digits = inputPhone.replace(/\D/g, "").replace(/^0+/, "");
  const active = members.filter(m => m.is_active && m.product_id === productId);
  if (!active.length) return null;

  // 1. Exato
  let match = active.find(m => m.phone === digits);
  if (match) return match.phone;

  // 2. Input 13 dígitos → tirar o 9 e comparar
  if (digits.length === 13 && digits.startsWith("55")) {
    const without9 = digits.slice(0, 4) + digits.slice(5);
    match = active.find(m => m.phone === without9);
    if (match) return match.phone;
  }

  // 3. Input 12 dígitos → adicionar o 9 e comparar
  if (digits.length === 12 && digits.startsWith("55")) {
    const with9 = digits.slice(0, 4) + "9" + digits.slice(4);
    match = active.find(m => m.phone === with9);
    if (match) return match.phone;
  }

  // 4. Últimos 8 dígitos
  const last8 = digits.slice(-8);
  match = active.find(m => m.phone.slice(-8) === last8);
  if (match) return match.phone;

  return null;
}
```

### 2. `src/components/entrega/DeliveryFlowDialog.tsx`

**Antes do upsert (linha ~282)**: buscar todos os `member_products` ativos do workspace para o produto atual usando `generatePhoneVariations` + últimos 8 dígitos. Chamar `findExistingMemberPhone`. Se encontrar, usar o telefone já salvo para a URL e o upsert. Se não, usar o `normalized` como hoje.

- Linha 213: expandir a query de `member_products` para incluir o campo `phone`
- Linha 283: `phone: phoneForUrl` (o telefone encontrado ou o normalized)
- Linha 313: `/${phoneForUrl}` na URL

### 3. `src/components/entrega/LinkGenerator.tsx`

**Antes do upsert (~linha 130)**: mesmo padrão — buscar `member_products` com variações, aplicar `findExistingMemberPhone`, usar o telefone encontrado para upsert e URL.

- Linha 135: `phone: phoneForUrl`
- Linha ~201: `/${phoneForUrl}` na URL

### 4. `src/components/leads/LeadDetailDialog.tsx`

**No onClick de "Copiar link" (linha ~281)**: já tem `memberProducts` carregado via query. Usar `findExistingMemberPhone` para pegar o telefone correto do banco e gerar a URL com ele. Se não houver match (não deveria acontecer pois já mostra produtos), usar o `normalized`.

- Linha 294: `/${phoneForUrl}` na URL

### 5. `src/components/membros/MemberClientCard.tsx`

**Linha 66**: O `phone` prop já vem direto do `member_products`. Usar ele diretamente sem passar por `normalizePhone`:

```typescript
const memberUrl = memberDomain ? `${memberDomain.replace(/\/$/, "")}/${phone.replace(/\D/g, "")}` : "";
```

### 6. Backend: `deploy/backend/src/routes/member-access.ts`

Expandir `phoneCandidates` com a mesma lógica de variações para que o backend encontre o registro mesmo que a URL tenha um formato ligeiramente diferente do banco:

```typescript
function generateVariations(phone: string): string[] {
  const s = new Set<string>();
  s.add(phone);
  let base = phone.startsWith("55") && phone.length >= 12 ? phone.slice(2) : phone;
  s.add(base);
  s.add("55" + base);
  const ddd = base.slice(0, 2);
  const rest = base.slice(2);
  if (rest.length === 9 && rest[0] === "9") {
    s.add(ddd + rest.slice(1));
    s.add("55" + ddd + rest.slice(1));
  } else if (rest.length === 8) {
    s.add(ddd + "9" + rest);
    s.add("55" + ddd + "9" + rest);
  }
  // últimos 8 dígitos serão tratados via query separada se necessário
  return Array.from(s).filter(Boolean);
}
```