

## Plano: Corrigir busca de dados do lead e melhorar layout do Boleto

### Problema
1. O `PaymentFlow` faz uma chamada separada a `/api/member-purchase/customer-info` que busca apenas em `transactions` e `conversations`, mas os dados do lead já existem na tabela `customers` (que já é consultada pelo endpoint `member-access` no carregamento inicial).
2. O `customerName` já está disponível no `MemberAccess.tsx` mas **não é passado** para o `PaymentFlow` — apenas o telefone é passado.
3. O layout do boleto precisa de refinamento visual.

### Solução

**1. Passar `customerName` do MemberAccess para os componentes de pagamento**

- `MemberAccess.tsx` → passar `customerName` como prop para `LockedOfferCard` e `PhysicalProductShowcase`
- `LockedOfferCard.tsx` → repassar para `PaymentFlow`
- `PhysicalProductShowcase.tsx` → repassar para `PaymentFlow`
- `PaymentFlow.tsx` → aceitar nova prop `customerName?: string`

**2. Backend: adicionar busca na tabela `customers`** (`deploy/backend/src/routes/member-purchase.ts`)

No endpoint `GET /customer-info`, adicionar um step **antes** de tudo:
```typescript
// Step 0: Search customers table first (most reliable source)
const { data: customer } = await sb
  .from("customers")
  .select("name, document, normalized_phone")
  .eq("workspace_id", workspace_id)
  .in("normalized_phone", phoneVariants)
  .limit(1)
  .maybeSingle();

if (customer?.name) {
  name = customer.name;
  document = customer.document || "";
}
```

Gerar variações de telefone (com/sem 9º dígito, com/sem prefixo 55) para o matching, usando a mesma lógica de `member-access.ts`.

**3. Frontend: usar dados já carregados como fallback**

Em `PaymentFlow.tsx`:
- Se `customerName` prop já existe, pré-preencher `boletoName` imediatamente sem esperar a chamada ao backend
- A chamada ao backend serve para buscar o CPF/documento (que não está disponível no frontend)
- Se o backend retornar nome, sobrescrever; caso contrário, manter o nome da prop

**4. Layout do Boleto — refinamentos**

Melhorar o card de dados do cliente:
- Adicionar separador visual entre nome e CPF
- Borda mais suave e padding consistente
- Texto "Confirme seus dados para gerar o boleto" acima do card
- Botão verde com ícone e texto mais claro

### Arquivos alterados
- `deploy/backend/src/routes/member-purchase.ts` — adicionar busca em `customers`
- `src/components/membros/PaymentFlow.tsx` — aceitar `customerName` prop, usar como fallback
- `src/components/membros/LockedOfferCard.tsx` — repassar `customerName`
- `src/components/membros/PhysicalProductShowcase.tsx` — repassar `customerName`
- `src/pages/MemberAccess.tsx` — passar `customerName` para os componentes

### Resultado
- Dados do lead encontrados imediatamente (nome via prop, CPF via backend com busca em `customers`)
- Layout profissional com dados pré-preenchidos
- Sem dependência exclusiva de `transactions`/`conversations` para encontrar o lead

