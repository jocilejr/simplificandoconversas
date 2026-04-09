# Fix: Query de Produtos Liberados usando API da VPS

## Problema

A query de `member_products` no `LeadDetailDialog` usa o client Supabase Cloud (`supabase.from("member_products")`), mas os dados estão no banco da VPS. Por isso sempre retorna 0.

## Solução

### Arquivo: `src/components/leads/LeadDetailDialog.tsx`

Trocar a query de `member_products` para usar a API da VPS via `fetch` (mesmo padrão usado em outros hooks do projeto que consultam a VPS).

1. Importar `api` de `@/lib/api` (ou usar `fetch` direto com a URL base da VPS)
2. Substituir a query atual que usa `supabase.from("member_products")` por uma chamada à VPS

**Opção mais simples**: Como o `DeliveryFlowDialog` já faz entregas via VPS e o `member_products` é populado lá, a melhor abordagem é criar um endpoint leve na VPS ou reutilizar o padrão existente.

**Porém**, revisando o projeto, o hook `useLeads` e outros componentes já usam `supabase` client direto para consultar tabelas como `transactions`, `conversations`, etc. — o que indica que **essas tabelas existem nos dois bancos** (VPS sincroniza com Cloud).

A questão é que `member_products` provavelmente **não está sendo sincronizada** com o Cloud.

### Solução recomendada: Consultar via API da VPS

Alterar a `queryFn` de `memberProducts` para fazer um `fetch` à API da VPS:

```typescript
const { data: memberProducts = [] } = useQuery({
  queryKey: ["lead-member-products", lead?.remote_jid, workspaceId],
  queryFn: async () => {
    const phone = lead!.phone_number || formatPhone(lead!.remote_jid);
    const variations = generatePhoneVariations(phone);
    if (!variations.length) return [];
    
    const res = await fetch(`${API_URL}/api/member-products?phones=${variations.join(",")}&workspace_id=${workspaceId}`);
    if (!res.ok) return [];
    return res.json();
  },
  enabled: open && !!lead && !!workspaceId,
});
```

### Arquivo: `deploy/backend/src/routes/platform-api.ts` (ou novo arquivo)

Criar endpoint `GET /api/member-products` que:

- Recebe `phones` (lista separada por vírgula) e `workspace_id`
- Consulta `member_products` com join em `delivery_products` filtrando por `normalized_phone IN (...)` e `workspace_id`
- Retorna `[{ id, normalized_phone, is_active, product_name }]`

## Resumo das mudanças

1. `**deploy/backend/src/routes/platform-api.ts**` — Novo endpoint `GET /api/member-products`
2. `**src/components/leads/LeadDetailDialog.tsx**` — Trocar query de Supabase Cloud para fetch na VPS