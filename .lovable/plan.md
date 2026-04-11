

## Plano: Corrigir listagem de materiais na Área de Membros

### Causa raiz
A query de materiais em `ContentManagement.tsx` (linha 134) usa um join PostgREST:
```
select("*, member_product_categories(name)")
```
Porém na VPS **não existe foreign key** entre `member_product_materials.category_id` e `member_product_categories.id`. Sem a FK, o PostgREST retorna erro e `data` vem `null`, fazendo a lista aparecer vazia.

### Solução (duas partes)

**1. Frontend — remover o join da query** (`ContentManagement.tsx`, linha 134)

Alterar de:
```typescript
.select("*, member_product_categories(name)")
```
Para:
```typescript
.select("*")
```

E resolver o nome da categoria em memória usando os dados já carregados na query `categories` (linha 123-129). Na renderização dos materiais, fazer lookup: `categories.find(c => c.id === mat.category_id)?.name`.

**2. VPS — adicionar a FK para futuro** (no `fix-member-tables.sql`)

Adicionar ao SQL de migração:
```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'member_product_materials_category_id_fkey'
  ) THEN
    ALTER TABLE public.member_product_materials
      ADD CONSTRAINT member_product_materials_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.member_product_categories(id)
      ON DELETE SET NULL;
  END IF;
END $$;
```

### Resultado esperado
Os materiais adicionados aparecerão imediatamente na listagem, mesmo sem a FK. Com a FK adicionada futuramente, o join voltará a funcionar também.

### Após deploy
```bash
cd ~/simplificandoconversas/deploy && bash update.sh
```

