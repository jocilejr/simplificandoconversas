

## Diagnóstico: Mensagens "Aguardando mensagem" não aparecem na aplicação

### Causa raiz

A Evolution API **não dispara webhook** para mensagens não descriptografadas. O estado "Aguardando mensagem" significa que o servidor ainda não recebeu as chaves de descriptografia do celular. Sem webhook, a aplicação nunca cria a conversa em tempo real.

A única forma de capturar esses contatos é via **sync-chats**, que usa `findChats` da Evolution API. Os logs confirmam que o sync-chats já processa essas conversas e as cria no banco com o placeholder correto. Porém:

1. Novas mensagens "aguardando" que chegam **depois** da última sincronização não aparecem até o próximo sync manual
2. Não existe um mecanismo automático para detectar esses contatos pendentes

### Plano de correção

#### 1. Sincronização automática periódica (backend cron)

Adicionar um cron job no backend Express que roda sync-chats automaticamente a cada 5 minutos (apenas `findChats` sem mensagens, para ser leve). Isso garante que conversas com mensagens não descriptografadas apareçam na aplicação sem ação manual.

**Arquivo:** `deploy/backend/src/routes/check-timeouts.ts` (ou novo arquivo de cron)
- Criar função `lightSync()` que chama `findChats` para cada instância conectada
- Cria/atualiza conversas no banco sem buscar mensagens individuais (rápido)
- Rodar a cada 5 minutos via cron existente no `index.ts`

#### 2. Melhorar o webhook para mensagens com stubType

Algumas mensagens "aguardando" podem chegar ao webhook com `messageStubType` definido mas sem conteúdo. Garantir que o webhook crie a conversa mesmo nesses casos.

**Arquivo:** `deploy/backend/src/routes/webhook.ts`
- Após a verificação de `messages.upsert`, não pular mensagens com `messageStubType` se tiverem um `remoteJid` válido
- Criar/atualizar a conversa mesmo sem conteúdo de mensagem

#### 3. Busca por telefone na lista de conversas

Atualmente o filtro de busca só procura por `contact_name` e `remote_jid`. Adicionar busca por `phone_number` para facilitar encontrar contatos.

**Arquivo:** `src/components/conversations/ConversationList.tsx`
- Incluir `c.phone_number` no filtro de busca

### Resumo de mudanças

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/index.ts` | Novo cron de light-sync a cada 5 min |
| `deploy/backend/src/routes/whatsapp-proxy.ts` | Extrair lógica de findChats+upsert em função reutilizável |
| `deploy/backend/src/routes/webhook.ts` | Tratar mensagens com stubType sem conteúdo |
| `src/components/conversations/ConversationList.tsx` | Busca por phone_number |

### Teste

Após deploy na VPS:
1. Verificar se conversas "Aguardando mensagem" aparecem em até 5 minutos sem sync manual
2. `docker logs deploy-backend-1 --tail 50 2>&1 | grep "light-sync"`

