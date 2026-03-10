

## Progresso e Problemas Restantes

O sync-chats agora funciona parcialmente: encontrou a instância "Adsd" da Evolution API com `connectionState=open`. Dois problemas restantes:

### 1. `findChats` retorna 0 chats
A instância "Adsd" está conectada mas `findChats` retorna array vazio. Isso pode significar:
- A instância acabou de ser conectada e não tem conversas ainda
- O endpoint `findChats` da Evolution API v2 precisa de parâmetros diferentes

Vou adicionar log do response bruto do `findChats` para diagnóstico, e também tentar o endpoint alternativo `/chat/findContacts` como fallback.

### 2. `[check-timeouts] Fetch error: {}`
O `JSON.stringify(fetchErr)` mostra `{}` porque o objeto de erro do Supabase tem propriedades não-enumeráveis. Preciso logar `fetchErr.message`, `fetchErr.code`, `fetchErr.details` individualmente. A tabela `flow_timeouts` tem 0 rows, então esse erro indica que o PostgREST não consegue acessar a tabela. Provavelmente o `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` estão incorretos no backend.

## Plano

### 1. Melhorar log do check-timeouts
Em `deploy/backend/src/routes/check-timeouts.ts`, trocar o log para mostrar propriedades individuais do erro:
```typescript
console.error("[check-timeouts] Fetch error:", fetchErr.message, fetchErr.code, fetchErr.details, fetchErr.hint);
```

### 2. Adicionar log detalhado no findChats
Em `deploy/backend/src/routes/whatsapp-proxy.ts`, no case `sync-chats`, logar o response bruto do findChats para diagnóstico:
```typescript
const chats = await evolutionRequest(...);
console.log(`[sync-chats] ${instName}: findChats raw response:`, JSON.stringify(chats)?.substring(0, 500));
```

### 3. Adicionar log de verificação da conexão PostgREST
No início do `processTimeouts`, adicionar um teste simples para verificar se o PostgREST está acessível:
```typescript
console.log(`[check-timeouts] Using URL: ${process.env.SUPABASE_URL}, key length: ${process.env.SUPABASE_SERVICE_ROLE_KEY?.length}`);
```

### Deploy
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose build --no-cache backend && docker compose up -d backend
docker compose logs backend --tail=30 -f
```

