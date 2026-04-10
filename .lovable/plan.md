

## Plano: Corrigir criação de ofertas + Usar descrição do produto na copy da oferta

### Problema 1: Falha ao salvar ofertas
O `fix-member-tables.sql` assume que a tabela `member_area_offers` já existe — ele só faz `ALTER TABLE ADD COLUMN IF NOT EXISTS`. Se a tabela não existir na VPS, todos os ALTERs falham e as ofertas não podem ser salvas.

**Solução**: Adicionar `CREATE TABLE IF NOT EXISTS` para `member_area_offers` no `fix-member-tables.sql`, antes dos ALTERs de coluna. Incluir todas as colunas necessárias, RLS habilitado e GRANT para os roles.

### Problema 2: Descrição do produto não alimenta a IA
A tabela `delivery_products` tem uma coluna `member_description` que deveria ser usada para enriquecer o contexto da IA ao gerar a copy de oferta, mas a rota `/offer-pitch` não a consulta.

**Solução**: Na rota `POST /offer-pitch` em `member-access.ts`, ao buscar o `product_id` da oferta, também buscar `member_description` de `delivery_products` e injetá-la no prompt como contexto adicional sobre o produto.

### Alterações

**1. `deploy/fix-member-tables.sql`**
Adicionar antes dos ALTERs de `member_area_offers`:
```sql
CREATE TABLE IF NOT EXISTS public.member_area_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Oferta',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  price numeric,
  purchase_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_area_offers ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_area_offers TO anon, authenticated, service_role;
```
Os ALTERs subsequentes adicionam as colunas extras (`product_id`, `image_url`, etc.) de forma idempotente.

Adicionar também políticas RLS no bloco de workspace policies (o array `_tables` já inclui a tabela, mas precisa de um fallback caso as policies não existam).

**2. `deploy/backend/src/routes/member-access.ts`**
Na rota `/offer-pitch`, ao buscar dados do produto (linha ~370-374), também buscar `member_description`:
```typescript
const { data: productData } = await sb
  .from("delivery_products")
  .select("member_cover_image, page_logo, member_description")
  .eq("id", offerData.product_id)
  .single();
```
E injetar `member_description` no prompt da IA:
```
SOBRE O PRODUTO (descrição do criador):
{member_description}
```

### Resultado
- Tabela `member_area_offers` é criada automaticamente pelo `update.sh` se não existir
- A descrição do produto (`member_description`) alimenta a IA para gerar copies mais contextualizadas
- Rodar `./update.sh` na VPS aplica tudo

