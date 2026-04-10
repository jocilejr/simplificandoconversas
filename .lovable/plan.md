
Problema real: a página pública já está batendo na rota correta (`/a/entrega/:phone` no frontend e `/api/member-access/:phone` no backend), mas o backend ainda quebra no acesso à tabela `member_area_settings`.

Do I know what the issue is? Sim: há um desencontro de schema na VPS e, além disso, o backend usa PostgREST (`http://postgrest:3000`), então após `ALTER TABLE` o cache de schema pode continuar antigo até ser recarregado.

Arquivos isolados:
- `deploy/backend/src/routes/member-access.ts`
- `deploy/init-db.sql`
- `deploy/fix-member-tables.sql`
- `src/pages/MemberAccess.tsx`

O que o código espera hoje em `member_area_settings`:
- `title`
- `logo_url`
- `welcome_message`
- `theme_color`
- `ai_persona_prompt`
- `greeting_prompt`
- `offer_prompt`

O que o schema base antigo cria em `deploy/init-db.sql`:
- `brand_name`
- `logo_url`
- `primary_color`
- `custom_domain`

Ou seja: sua VPS está parcialmente no schema antigo.

Plano de correção

1. Confirmar dentro da VPS quais colunas existem de fato
```bash
docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'member_area_settings'
ORDER BY ordinal_position;
"
```

2. Corrigir todas as colunas faltantes na VPS, não só 3
```bash
docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS welcome_message text;
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#8B5CF6';
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS ai_persona_prompt text;
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS greeting_prompt text;
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS offer_prompt text;
"
```

3. Recarregar o cache do PostgREST, porque o backend consulta via PostgREST e ele pode continuar enxergando o schema antigo
```bash
docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
```

4. Testar de novo direto no backend
```bash
docker exec deploy-backend-1 wget -qO- http://localhost:3001/api/member-access/5589981340810 2>&1 | head -40
```

5. Se ainda der erro, pegar o novo erro exato dos logs
```bash
docker logs deploy-backend-1 --tail=50 2>&1 | grep -i "member-access"
```

6. Correção permanente no código para não quebrar em próximos deploys
- Atualizar `deploy/fix-member-tables.sql` para também adicionar essas colunas em `member_area_settings`
- Atualizar `deploy/init-db.sql` para a definição base de `member_area_settings` refletir o schema atual usado pelo app
- Opcionalmente endurecer `deploy/backend/src/routes/member-access.ts` para tolerar schema legado, mas o ideal é alinhar a VPS ao schema atual

Se quiser, na próxima mensagem me envie exatamente a saída destes 3 comandos:
```bash
docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'member_area_settings'
ORDER BY ordinal_position;
"

docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"

docker exec deploy-backend-1 wget -qO- http://localhost:3001/api/member-access/5589981340810 2>&1 | head -40
```
Com isso eu te digo exatamente o próximo ajuste dentro da VPS antes de qualquer nova alteração no projeto.
