

## Diagnóstico: Backend recebe a requisição mas falha silenciosamente nas operações de banco

### Evidências
- Backend logs mostram `[whatsapp-proxy] Authenticated userId: 46ed58c8-...` -- a requisição chega e a autenticação funciona
- Nenhum erro é logado depois da autenticação -- as operações de DB falham silenciosamente
- Todos os endpoints da Evolution API funcionam perfeitamente (testados via Docker)
- O schema do banco está correto (unique constraints existem em `init-db.sql`)

### Causa provável
As chamadas ao `serviceClient` (supabase-js apontando para `http://nginx:80`) podem estar falhando sem que o erro seja capturado. O código atual não loga o resultado/erro de nenhuma operação de banco no `fetch-instances`, `sync-chats` ou `send-message`.

### Plano

**1. Adicionar logging de diagnóstico em `deploy/backend/src/routes/whatsapp-proxy.ts`**

Em cada operação de banco (upsert, update, insert, select), capturar e logar o `error` retornado pelo supabase-js. Exemplo para `fetch-instances`:

```typescript
const { data, error } = await serviceClient.from("whatsapp_instances").upsert(...);
if (error) console.error("[fetch-instances] DB upsert error:", error);
else console.log("[fetch-instances] Upserted instance:", name);
```

Aplicar o mesmo padrão para:
- `fetch-instances`: upsert + activeCheck query + update
- `send-message`: select active instance (linha 82-89) + upsert conversation + insert message
- `sync-chats`: upsert instances + update status + upsert conversations + insert messages

**2. Adicionar endpoint de diagnóstico de DB no backend**

Criar rota `GET /api/health/db` que testa:
- Conexão com PostgREST via serviceClient (`select count(*) from whatsapp_instances`)
- Retorna URL sendo usada e resultado

**3. Testar na VPS**

Após rebuild, o usuário executa:
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose up -d --build backend
# Testar health
docker compose exec backend wget -qO- http://localhost:3001/health
# Testar DB
docker compose exec backend wget -qO- http://localhost:3001/api/health/db
# Depois, usar o app e verificar logs
docker compose logs backend --tail=30 -f
```

Os logs revelarão exatamente onde e por que as operações de DB estão falhando.

