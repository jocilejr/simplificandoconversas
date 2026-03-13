

## Diagnóstico Manual do Light-Sync

### Problema

O light-sync roda a cada 5 min mas os contatos "Aguardando mensagem" não aparecem. Precisamos entender **o que a Evolution API está retornando** nos endpoints `findChats` e `findContacts` para diagnosticar se o problema é na API ou na lógica de upsert.

### Mudanças

#### 1. `deploy/backend/src/routes/whatsapp-proxy.ts` — Novas ações de diagnóstico

Adicionar 3 novas ações no switch/case:

| Ação | O que faz |
|------|-----------|
| `debug-findcontacts` | Chama `/chat/findContacts/{instance}` e retorna os primeiros 10 contatos individuais com dados brutos |
| `debug-lightsync` | Executa o `lightSync()` manualmente e retorna o resultado imediato |
| `debug-conversations` | Lista as últimas 20 conversas do banco para comparar com o que a API retorna |

Isso permite rodar via curl na VPS:
```bash
# Ver o que findChats retorna
curl -X POST http://localhost:3001/api/whatsapp-proxy \
  -H "Content-Type: application/json" \
  -d '{"action":"debug-findchats"}'

# Ver o que findContacts retorna  
curl -X POST http://localhost:3001/api/whatsapp-proxy \
  -H "Content-Type: application/json" \
  -d '{"action":"debug-findcontacts"}'

# Forçar light-sync agora
curl -X POST http://localhost:3001/api/whatsapp-proxy \
  -H "Content-Type: application/json" \
  -d '{"action":"debug-lightsync"}'

# Ver conversas no banco
curl -X POST http://localhost:3001/api/whatsapp-proxy \
  -H "Content-Type: application/json" \
  -d '{"action":"debug-conversations"}'
```

#### 2. `deploy/backend/src/routes/light-sync.ts` — Logs mais detalhados

Adicionar log de **cada JID processado** (não só os novos) para ver exatamente o que está sendo filtrado ou ignorado:
- Log dos JIDs retornados por `findChats`
- Log dos JIDs retornados por `findContacts`  
- Log de quais já existem no banco vs quais são novos
- Log de erros de upsert com payload completo

### Fluxo de Diagnóstico

Após deploy, o usuário poderá:
1. Rodar `debug-findchats` → ver se os contatos "Aguardando" estão na resposta da API
2. Rodar `debug-findcontacts` → ver se aparecem como contatos
3. Rodar `debug-lightsync` → forçar execução e ver logs em tempo real
4. Rodar `debug-conversations` → comparar o que está no banco

Isso vai revelar exatamente onde os contatos estão sendo perdidos.

