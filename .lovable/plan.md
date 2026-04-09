

# Fix: LinkGenerator.tsx usando coluna errada no upsert

## Problema

A tabela `member_products` na VPS tem a coluna `phone`, mas o `LinkGenerator.tsx` faz upsert com `normalized_phone`. O upsert falha silenciosamente e nenhum registro é criado.

## Solução

### Arquivo: `src/components/entrega/LinkGenerator.tsx`

Trocar todas as referências de `normalized_phone` por `phone` no upsert de `member_products`:

```typescript
// ANTES (linha ~109)
await supabase.from("member_products").upsert(
  {
    workspace_id: workspaceId,
    product_id: product.id,
    normalized_phone: normalized,
    is_active: true,
  },
  { onConflict: "workspace_id,product_id,normalized_phone" }
);

// DEPOIS
await supabase.from("member_products").upsert(
  {
    workspace_id: workspaceId,
    product_id: product.id,
    phone: normalized,
    is_active: true,
  },
  { onConflict: "product_id,phone" }
);
```

Mesma correção no segundo upsert (~linha 138). O `onConflict` deve usar `product_id,phone` para corresponder ao unique constraint real da VPS (`member_products_product_id_phone_key`).

Após deploy na VPS, gere um link de teste para verificar que o registro é criado em `member_products`.

