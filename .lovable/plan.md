
## Plano: Corrigir o novo erro ao salvar ofertas na VPS

### Diagnóstico
O erro do print não é de permissão. É uma divergência de schema na VPS:

- o frontend salva oferta usando `name`
- o código atual não envia `title`
- mas a tabela `member_area_offers` na sua VPS ainda está exigindo `title NOT NULL`

Resultado: o insert falha com `null value in column "title"`.

Além disso, o repositório está inconsistente:
- `src/pages/AreaMembros.tsx` usa `name`
- `supabase/migrations/...member_area_offers...sql` usa só `name`
- `deploy/init-db.sql` ainda carrega legado com `title`
- `deploy/fix-member-tables.sql` não corrige um `title NOT NULL` já existente

### O que vou ajustar

**1. Corrigir o schema de ofertas na VPS**
Arquivo: `deploy/fix-member-tables.sql`

Adicionar um bloco de compatibilidade para:
- garantir `name`
- garantir `title` apenas como legado opcional
- remover `NOT NULL` de `title`
- preencher `name` a partir de `title` quando necessário
- preencher `title` a partir de `name` quando necessário
- definir `name` como campo canônico

Em prática, a correção fará algo nessa linha:
```sql
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.member_area_offers ALTER COLUMN title DROP NOT NULL;

UPDATE public.member_area_offers
SET name = COALESCE(NULLIF(name, ''), NULLIF(title, ''), 'Oferta')
WHERE name IS NULL OR btrim(name) = '';

UPDATE public.member_area_offers
SET title = COALESCE(NULLIF(title, ''), name, 'Oferta')
WHERE title IS NULL OR btrim(title) = '';

ALTER TABLE public.member_area_offers ALTER COLUMN name SET DEFAULT 'Oferta';
ALTER TABLE public.member_area_offers ALTER COLUMN name SET NOT NULL;
```

**2. Unificar o schema base para novas VPS**
Arquivo: `deploy/init-db.sql`

Deixar o schema inicial coerente com o app atual:
- `name` como campo principal
- `title` apenas legado opcional, sem `NOT NULL`
- evitar que uma instalação nova recrie o problema

**3. Blindar a leitura das ofertas**
Arquivo: `deploy/backend/src/routes/member-access.ts`

Ao retornar ofertas para a área de membros, normalizar o nome:
```ts
name: offer.name || offer.title || "Oferta"
```

Isso evita card vazio caso existam registros antigos na VPS.

**4. Blindar a listagem/admin das ofertas**
Arquivo: `src/pages/AreaMembros.tsx`

Manter o save usando `name`, mas ajustar a exibição para fallback seguro em registros antigos:
- exibir `offer.name || offer.title || "Oferta"`

### Verificação que vou te pedir para rodar DENTRO da VPS
Antes e depois da correção, quero que você rode estes comandos:

```bash
cd ~/simplificandoconversas/deploy

docker compose exec -T postgres psql -U postgres -d postgres -c "
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'member_area_offers'
  AND column_name IN ('name','title')
ORDER BY column_name;
"
```

```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "
SELECT
  count(*) FILTER (WHERE name IS NULL OR btrim(name) = '') AS sem_name,
  count(*) FILTER (WHERE title IS NULL OR btrim(title) = '') AS sem_title
FROM public.member_area_offers;
"
```

Depois da atualização, o esperado é:
- `name` preenchido
- `title` permitido como nulo
- criação de oferta funcionando sem erro

### Resultado esperado
- o modal “Nova Oferta” volta a salvar normalmente
- ofertas antigas continuam aparecendo
- a VPS deixa de depender do campo legado `title`
- o problema não volta em futuras atualizações do `./update.sh`
