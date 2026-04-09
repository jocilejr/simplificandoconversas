

# Fix: DeliveryFlowDialog — `normalized_phone` → `phone` no `member_products`

## Problema
O `DeliveryFlowDialog.tsx` (o fluxo que você realmente usa) faz query e upsert em `member_products` usando a coluna `normalized_phone`, que não existe na VPS. Por isso o upsert falha silenciosamente e nenhum registro é criado.

## Correção — apenas 2 linhas no arquivo `src/components/entrega/DeliveryFlowDialog.tsx`

### Linha 217 — query de verificação
```typescript
// DE:
.in("normalized_phone", variations)
// PARA:
.in("phone", variations)
```

### Linhas 282-283 — upsert
```typescript
// DE:
{ workspace_id: workspaceId, product_id: product.id, normalized_phone: normalized, is_active: true },
{ onConflict: "workspace_id,product_id,normalized_phone" }

// PARA:
{ workspace_id: workspaceId, product_id: product.id, phone: normalized, is_active: true } as any,
{ onConflict: "product_id,phone" }
```

Nenhum outro arquivo será alterado. Só esses 2 pontos no `DeliveryFlowDialog.tsx`.

## Verificação na VPS após deploy
```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "SELECT * FROM member_products;"
```

