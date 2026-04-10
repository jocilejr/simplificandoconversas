

## Plano: Aplicar migração das tabelas de membros na VPS + corrigir Storage RLS

### Causa raiz

As tabelas `member_product_categories` e `member_product_materials` **não existem** no banco da VPS (`deploy-postgres-1`). A migração foi aplicada apenas no Lovable Cloud. Além disso, o bucket `member-files` no Storage não tem políticas RLS, bloqueando uploads.

### Correção (2 partes)

**Parte 1 — Atualizar `deploy/init-db.sql`**

Substituir as definições antigas de `member_product_categories` e `member_product_materials` pelo schema novo (com colunas `product_id`, `icon`, `description`, `content_text`, `button_label`, `is_preview`). Adicionar as 7 tabelas novas da segunda migração (`member_content_progress`, `member_pixel_frames`, `member_offer_impressions`, `daily_prayers`, `openai_settings`, `product_knowledge_summaries`, `manual_boleto_settings`) + as 2 funções RPC + as 4 políticas de Storage para o bucket `member-files`.

**Parte 2 — SQL para rodar manualmente na VPS**

Gerar um script SQL idempotente (`IF NOT EXISTS` / `DROP TABLE IF EXISTS`) que você rodará na VPS com:

```bash
docker exec -i deploy-postgres-1 psql -U supabase_admin -d postgres < /tmp/fix-member-tables.sql
```

O script fará:

1. **DROP** das tabelas antigas `member_product_categories` e `member_product_materials` (se existirem com schema antigo)
2. **CREATE** das 2 tabelas com schema novo + RLS + triggers
3. **CREATE** das 7 tabelas novas + RLS
4. **CREATE** das 2 funções RPC (`increment_offer_impression`, `increment_offer_click`)
5. **CREATE** das 4 políticas de Storage no `storage.objects` para o bucket `member-files`
6. **GRANT** para `anon`, `authenticated`, `service_role`

**Parte 3 — Atualizar `deploy/migrate-workspace.sql`**

Adicionar as 7 tabelas novas aos arrays `_tables` para que o sistema multi-tenant aplique `workspace_id` e RLS corretamente.

### Após aplicar

Na VPS:
```bash
cd ~/simplificandoconversas/deploy
docker exec -i deploy-postgres-1 psql -U supabase_admin -d postgres < /tmp/fix-member-tables.sql
docker compose up -d --force-recreate backend
```

