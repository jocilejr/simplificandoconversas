

## Plano: Trocar métrica "vendas" por "conversões" (escolha de pagamento)

### Contexto
Atualmente o badge "vendas" conta `member_products` ativos (acessos liberados), que não reflete o funil real. O que importa é saber quantas pessoas **chegaram até a escolha de pagamento e preencheram dados** — ou seja, quantas interagiram com o PaymentFlow.

A tabela `member_offer_impressions` já existe e rastreia impressões e cliques. Vamos adicionar um campo `payment_started` para registrar quando o membro seleciona um método de pagamento.

### Alterações

**1. Migração SQL — adicionar coluna `payment_started`**
```sql
ALTER TABLE member_offer_impressions 
  ADD COLUMN IF NOT EXISTS payment_started boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method text;
```
E no `deploy/init-db.sql` e `deploy/migrate-workspace.sql` incluir as colunas.

**2. `src/components/membros/PaymentFlow.tsx`**
Quando o membro clica em PIX, Cartão ou Boleto, registrar na `member_offer_impressions`:
```typescript
supabase.from("member_offer_impressions").upsert({
  normalized_phone: memberPhone,
  offer_id: offer.id,
  payment_started: true,
  payment_method: "pix", // ou "cartao" / "boleto"
}, { onConflict: "normalized_phone,offer_id" });
```

**3. `src/pages/AreaMembros.tsx`**
- Trocar a query `offer-conversions` para contar `member_offer_impressions` onde `payment_started = true`, agrupando por `offer_id`
- Renomear badge de "vendas" para "conversões"
- Exibir o count por offer_id (não mais por product_id)

**4. `deploy/init-db.sql` + `deploy/migrate-workspace.sql`**
Incluir as novas colunas na definição da tabela para novas instalações e atualizações.

### Resultado
- O badge mostra quantas pessoas **entraram no funil de pagamento** de cada oferta
- Não depende de vendas confirmadas ou acessos liberados
- Métrica útil para comparar performance entre ofertas

