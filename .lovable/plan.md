

# Fix: Coluna `normalized_phone` não existe — usar `phone`

## Problema

A tabela `member_products` na VPS usa a coluna `phone`, mas o endpoint backend está consultando `normalized_phone` (que não existe). Por isso o endpoint retorna erro 500 silenciosamente e o frontend mostra 0 produtos.

## Solução

### 1. Backend: `deploy/backend/src/routes/platform-api.ts` (linhas 1405-1409)

Trocar `normalized_phone` por `phone` na query:

```typescript
const { data, error } = await sb
  .from("member_products")
  .select("id, phone, is_active, product_id, delivery_products(name)")
  .eq("workspace_id", workspace_id)
  .in("phone", phones);
```

### 2. Frontend: `src/components/leads/LeadDetailDialog.tsx`

Atualizar qualquer referência a `normalized_phone` nos dados retornados para `phone`.

Após a mudança, será necessário rebuild do backend na VPS:
```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

