

# Fix: Tabelas de Entrega Digital não existem na VPS

## Problema raiz

As tabelas `delivery_products`, `member_products`, `delivery_settings`, `delivery_accesses`, `delivery_link_generations`, `delivery_pixels`, `global_delivery_pixels`, `member_area_settings`, `member_area_offers`, `member_product_categories`, `member_product_materials`, `member_sessions` **nunca foram criadas na VPS**. Elas existem apenas como migrações do Lovable Cloud (que você não usa), mas não estão no `init-db.sql` nem no `migrate-workspace.sql`.

Por isso: erro ao salvar produto e lentidão (queries ficam em loop tentando acessar tabelas inexistentes via PostgREST).

## Solução

Duas ações necessárias:

### 1. Adicionar as tabelas ao `deploy/init-db.sql`

Consolidar todo o SQL das migrações `20260409035234` e `20260409041813` (+ coluna `delivery_message` da migração posterior) no `init-db.sql`, garantindo que novas instalações já criem tudo.

### 2. Adicionar as tabelas ao `deploy/migrate-workspace.sql`

Registrar as novas tabelas nos arrays `_tables` para que recebam `workspace_id` e políticas RLS automaticamente.

### 3. Script SQL para executar na VPS agora

Você precisará executar o SQL completo na VPS para criar as tabelas que faltam. Vou gerar um script consolidado que você roda com:

```bash
docker exec -i deploy-postgres-1 psql -U postgres -d postgres < /tmp/fix-delivery.sql
```

O script conterá todas as tabelas na ordem correta (respeitando foreign keys):
1. `delivery_products` (base)
2. `member_products`
3. `member_area_settings`
4. `member_area_offers`
5. `member_product_categories`
6. `member_product_materials`
7. `member_sessions`
8. `delivery_pixels`
9. `delivery_accesses`
10. `delivery_settings` (com coluna `delivery_message`)
11. `delivery_link_generations`
12. `global_delivery_pixels`

Cada tabela terá RLS + políticas workspace + triggers `updated_at` + índices.

Após criar as tabelas, o script executa `NOTIFY pgrst, 'reload schema'` para o PostgREST reconhecer tudo imediatamente.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `deploy/init-db.sql` | Adicionar todas as 12 tabelas de delivery/membros |
| `deploy/migrate-workspace.sql` | Registrar tabelas nos arrays `_tables` |
| `deploy/update.sh` | Registrar tabelas na lista de validação |

## Sobre a lentidão

A lentidão desaparece automaticamente após criar as tabelas — o PostgREST atualmente retorna erro 404/timeout para cada query a tabelas inexistentes, causando retries no frontend.

