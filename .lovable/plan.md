

## Problema

Dois problemas distintos na instalação self-hosted:

### 1. Erro 406 "Not Acceptable" no `/rest/v1/profiles`
O PostgREST retorna 406 quando o frontend usa `.single()` mas **nenhuma linha existe**. O admin foi criado no GoTrue (auth), mas não existe uma linha correspondente na tabela `profiles`. No Lovable Cloud, existe um trigger automático em `auth.users` que cria o perfil. No self-hosted, esse trigger não existe.

### 2. WebSocket Realtime falhando
O `docker-compose.yml` não inclui o serviço Supabase Realtime, e o Nginx não tem location para `/realtime/v1/`. O frontend tenta conectar via WebSocket e falha infinitamente.

---

## Solução

### A. Criar trigger para auto-criar perfil (init-db.sql)

Adicionar um trigger em `auth.users` que cria automaticamente uma linha em `public.profiles` quando um novo usuário é criado:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

Além disso, criar o perfil manualmente para o admin já existente (o usuário precisará rodar um SQL).

### B. Desabilitar Realtime no frontend self-hosted

O frontend precisa lidar graciosamente com a ausência do Realtime. Duas opções:
- Adicionar o serviço Supabase Realtime ao docker-compose (complexo, requer mais configuração)
- Ou simplesmente desabilitar as tentativas de conexão Realtime quando o serviço não existe

A abordagem recomendada é adicionar um fallback com polling no frontend para quando WebSocket falhar, mas para resolver rápido, podemos **desabilitar a subscription realtime** quando detectar que estamos no self-hosted, ou simplesmente silenciar os erros.

### Passos de implementação:

1. **Atualizar `deploy/init-db.sql`** com o trigger `handle_new_user` em `auth.users`
2. **Criar perfil para o admin existente** — fornecer comando SQL para rodar na VPS
3. **Tornar Realtime opcional no frontend** — verificar se a conexão WebSocket falha e usar polling como fallback nos hooks `useMessages` e `useConversations`

### Comando imediato para o admin existente (VPS):

```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "
  -- Criar trigger
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$\$
  BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END;
  \$\$;

  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

  -- Criar perfil para o admin já existente
  INSERT INTO public.profiles (user_id, full_name)
  SELECT id, raw_user_meta_data->>'full_name'
  FROM auth.users
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.users.id)
  ON CONFLICT DO NOTHING;
"
```

### Alterações nos arquivos:

- `deploy/init-db.sql` — adicionar trigger `handle_new_user`
- `src/hooks/useConversations.ts` — tornar Realtime subscription resiliente (catch errors, fallback polling)
- `src/hooks/useMessages.ts` — mesmo tratamento
- `src/hooks/useProfile.ts` — usar `.maybeSingle()` em vez de `.single()` e criar perfil automaticamente se não existir

