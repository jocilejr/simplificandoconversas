

## Plano: Corrigir busca de dados do lead na VPS (tabela `customers` não existe)

### Causa raiz confirmada
A tabela `customers` **não existe na VPS**. Ela só existe no Lovable Cloud. O backend `member-access.ts` faz query em `customers` (linhas 85-108), recebe erro silencioso, e retorna `customer: null`. Por isso o nome e CPF nunca chegam ao frontend.

### Fontes reais de dados do lead na VPS

| Dado | Tabela | Coluna |
|------|--------|--------|
| Nome | `transactions` | `customer_name` |
| CPF | `transactions` | `customer_document` |
| Nome (fallback) | `conversations` | `contact_name` |

### Solução

**1. Backend `member-access.ts` — substituir query em `customers` por busca em `transactions` + `conversations`**

Remover completamente as queries à tabela `customers` (linhas 85-108) e substituir por:

```typescript
// Buscar dados do lead em transactions (fonte mais confiável para nome + CPF)
const txRes = await sb
  .from("transactions")
  .select("customer_name, customer_document, customer_phone")
  .eq("workspace_id", workspaceId)
  .in("customer_phone", phoneCandidates)
  .not("customer_name", "is", null)
  .order("created_at", { ascending: false })
  .limit(1);

let customerName = txRes.data?.[0]?.customer_name || null;
let customerDocument = txRes.data?.[0]?.customer_document || null;

// Fallback: last 8 digits em transactions
if (!customerName) {
  // busca fuzzy por últimos 8 dígitos
}

// Fallback: conversations.contact_name
if (!customerName) {
  // busca em conversations por remote_jid
}
```

Retornar no JSON:
```typescript
customer: {
  name: customerName,
  document: customerDocument,
}
```

**2. Backend `member-access.ts` — rota `/ai-context` (linha 276-282)**

Mesma correção: substituir query em `customers` por busca em `transactions`.

**3. Backend `member-purchase.ts` — rota `/customer-info` (linhas 107-123)**

Remover o bloco try/catch que tenta buscar em `customers` (que falha silenciosamente). O resto da lógica (busca em transactions e conversations) já funciona corretamente.

**4. Frontend — sem alterações necessárias**

O prop drilling já está implementado corretamente (`MemberAccess → LockedOfferCard/PhysicalProductShowcase → PaymentFlow`). Quando o backend passar a retornar os dados corretos, o preenchimento automático vai funcionar.

### Arquivos alterados
- `deploy/backend/src/routes/member-access.ts` — substituir queries em `customers` por `transactions` + `conversations`
- `deploy/backend/src/routes/member-purchase.ts` — remover bloco `customers` que falha silenciosamente

### Após implementação, rode na VPS
```bash
cd ~/simplificandoconversas/deploy && bash update.sh
```

### Resultado esperado
- Nome e CPF do lead encontrados via `transactions` (a fonte real na VPS)
- Modal de pagamento abre com dados pré-preenchidos
- Sem mais queries a tabelas inexistentes

