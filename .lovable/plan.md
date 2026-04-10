

## Plano: Corrigir listagem de ofertas (join PostgREST falhando)

### Diagnóstico
A oferta é salva corretamente, mas **não aparece na lista** porque a query usa um join embutido do PostgREST:

```typescript
.select("*, delivery_products(name, page_logo)")
```

Para isso funcionar, o PostgREST precisa de uma **foreign key** entre `member_area_offers.product_id` e `delivery_products.id`. Essa FK não existe na VPS — o `fix-member-tables.sql` apenas faz `ADD COLUMN IF NOT EXISTS product_id uuid` sem constraint.

Quando o PostgREST não consegue resolver o relacionamento, ele retorna erro ou array vazio, e a lista fica vazia.

### Correções

**1. Adicionar FK no banco (`deploy/fix-member-tables.sql`)**
Adicionar após os ALTERs de `member_area_offers`:
```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'member_area_offers_product_id_fkey'
  ) THEN
    ALTER TABLE public.member_area_offers
      ADD CONSTRAINT member_area_offers_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.delivery_products(id)
      ON DELETE SET NULL;
  END IF;
END $$;
```

**2. Blindar a query no frontend (`src/pages/AreaMembros.tsx`)**
Caso a FK ainda falhe em algum ambiente, mudar a query para buscar ofertas e produtos separadamente e fazer o merge em memória (padrão já usado em outras partes do sistema):

```typescript
// Buscar ofertas sem join
const { data } = await supabase
  .from("member_area_offers")
  .select("*")
  .eq("workspace_id", workspaceId!)
  .order("sort_order");
return data || [];
```

E no render, buscar o nome do produto do array `products` já carregado:
```typescript
const product = products?.find(p => p.id === offer.product_id);
const productName = product?.name || offer.name || "Oferta";
```

Isso segue o padrão de **merge em memória** já documentado no projeto para evitar dependência de FKs no PostgREST da VPS.

**3. Atualizar `deploy/init-db.sql`**
Incluir a FK na definição base para novas instalações.

### Verificação na VPS
Após `./update.sh`, rode:
```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "
SELECT * FROM public.member_area_offers ORDER BY created_at DESC LIMIT 5;
"
```

### Resultado
- Ofertas salvas aparecem imediatamente na lista
- Não depende mais de join PostgREST funcionar
- FK adicionada para ambientes futuros

