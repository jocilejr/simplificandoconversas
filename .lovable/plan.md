
## Fix: supabase-js URL Path Mismatch + Chat Persistence — Concluído ✅

### Root Cause
O backend usava `SUPABASE_URL=http://postgrest:3000`, mas o `supabase-js` adiciona `/rest/v1/` automaticamente, causando 404 no PostgREST.

### Mudanças realizadas

| Área | Mudança |
|------|---------|
| **nginx** | `server_name` do API server block agora aceita `nginx` e `localhost` como hostnames internos |
| **docker-compose** | Backend `SUPABASE_URL` alterado de `http://postgrest:3000` → `http://nginx:80`; `depends_on` inclui `nginx` |
| **portainer-stack** | Mesmas alterações do docker-compose |
| **check-timeouts** | Logging melhorado com `Object.getOwnPropertyNames` para capturar erros raw |
| **Evolution API** | `DATABASE_SAVE_DATA_CHATS` alterado de `false` → `true` em ambos os compose files |
