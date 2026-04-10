
Objetivo: corrigir a migração da VPS para que ela rode até o fim, recrie as tabelas da área de membros e libere upload no bucket `member-files`.

Diagnóstico confirmado:
1. O script falhou em `CREATE OR REPLACE FUNCTION increment_offer_impression(...)` porque ele referencia `member_area_offers.total_impressions` antes de a coluna existir.
2. Como tudo está dentro de `BEGIN`, a transação entrou em erro e fez `ROLLBACK`.
3. O `SELECT 'Member tables migration completed!'` no final é enganoso: ele executou depois do rollback, mas a migração não foi aplicada.
4. O schema self-hosted em `deploy/init-db.sql` ainda está desatualizado para `member_area_offers`:
   - atual: `views`, `clicks`, `sales`, `title`, `cta_url`, `cta_text`
   - esperado pelo app atual: `name`, `product_id`, `image_url`, `purchase_url`, `display_type`, `pix_key`, `pix_key_type`, `card_payment_url`, `category_tag`, `total_impressions`, `total_clicks`, `sort_order`

Plano de correção:

1. Ajustar `deploy/fix-member-tables.sql`
   - mover os `ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS total_impressions...` e `total_clicks...` para antes das funções RPC
   - idealmente, mover toda a correção de `member_area_offers` para antes de qualquer função que dependa dela
   - tornar o bloco mais resiliente:
     - adicionar também `name`, `product_id`, `image_url`, `purchase_url`, `display_type`, `pix_key`, `pix_key_type`, `card_payment_url`, `category_tag`, `sort_order`
     - manter compatibilidade com a tabela antiga sem depender de drop total da `member_area_offers`

2. Alinhar `deploy/init-db.sql`
   - atualizar a definição base de `member_area_offers` para o schema que o frontend usa hoje
   - isso evita que novos setups da VPS nasçam com schema antigo e quebrem novamente depois

3. Revisar `deploy/migrate-workspace.sql`
   - confirmar que as novas tabelas já adicionadas continuam registradas nos arrays `_tables`
   - manter `member_area_offers` e as novas tabelas no fluxo de `workspace_id`/RLS

4. Melhorar o script de migração para evitar falso positivo
   - remover a mensagem final “completed” solta ou condicioná-la a `COMMIT` real
   - assim, se houver rollback, o resultado não parecerá sucesso

5. Validar na VPS depois da correção
   - pedir para rodar, dentro da VPS:
```bash
docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'member_area_offers'
ORDER BY ordinal_position;"
```
   - depois reaplicar:
```bash
docker exec -i deploy-postgres-1 psql -U postgres -d postgres < ~/simplificandoconversas/deploy/fix-member-tables.sql
```
   - e validar:
```bash
docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT policyname, cmd
FROM pg_policies
WHERE tablename IN ('member_product_materials','member_product_categories')
ORDER BY tablename, policyname;"
```
```bash
docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;"
```

Resultado esperado após implementar:
- a migração deixa de abortar
- `member_product_categories` e `member_product_materials` passam a existir na VPS
- as RPCs de oferta são criadas com sucesso
- as policies de Storage do bucket `member-files` passam a existir
- o frontend da área de membros deixa de depender de colunas ausentes no banco da VPS

Detalhe técnico importante:
O problema principal não é só “falta a coluna”; é também “ordem incorreta da migração” + “schema base self-hosted divergente do schema real usado pela aplicação”. Vou corrigir os dois juntos para não voltar a quebrar no próximo deploy.
