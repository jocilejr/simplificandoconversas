

## Problema

A tabela `profiles` tem linhas duplicadas para o mesmo `user_id` (`46ed58c8-fb6b-4eb5-ad02-bd54a6c098d6` aparece 2x). O método `.maybeSingle()` do Supabase retorna erro quando encontra mais de uma linha, causando falha silenciosa ao carregar o perfil.

## Solução

### 1. Remover a linha duplicada no banco (VPS)

Execute no terminal da VPS para identificar e remover o duplicado, mantendo apenas a linha mais recente:

```bash
docker exec -it deploy-postgres-1 psql -U postgres -d postgres --pset=pager=off -c "
DELETE FROM profiles
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) as rn
    FROM profiles
  ) t WHERE rn > 1
);"
```

### 2. Adicionar constraint UNIQUE para prevenir duplicatas futuras

```bash
docker exec -it deploy-postgres-1 psql -U postgres -d postgres -c "
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);"
```

### 3. Atualizar o hook `useProfile` para usar `.single()` com tratamento robusto

No arquivo `src/hooks/useProfile.ts`, trocar `.maybeSingle()` por `.limit(1).single()` para garantir que sempre retorna apenas uma linha, mesmo em caso de dados inconsistentes.

## Impacto
- Corrige a persistência da mensagem PIX/Boleto
- Previne duplicatas futuras
- Nenhuma mudança visual na interface

