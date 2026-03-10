

## Problema: `@lid` cria conversas duplicadas — resolver para número real

### Análise dos logs

O FULL CHAT DUMP mostra que cada chat tem:
- `remoteJid`: pode ser `@g.us` (grupo), `@s.whatsapp.net` (número real) ou `@lid` (ID interno)
- `lastMessage.key.participantAlt`: contém o número real no formato `553194559849@s.whatsapp.net` quando o JID principal é `@lid`

O webhook sempre recebe o `remoteJid` no formato `@s.whatsapp.net`. Mas o sync-chats recebe `@lid` para alguns contatos. Resultado: duas conversations para a mesma pessoa.

### Correção

**Arquivo: `deploy/backend/src/routes/whatsapp-proxy.ts`**

1. Criar helper `resolveToPhoneJid(chat)` que:
   - Se `remoteJid` já é `@s.whatsapp.net` → retorna como está
   - Se `remoteJid` é `@lid` → busca o número real em:
     - `chat.lastMessage.key.participantAlt`
     - `chat.lastMessage.key.remoteJid` (se for `@s.whatsapp.net`)
   - Se não encontrar equivalente → usa o `@lid` como fallback

2. Aplicar `resolveToPhoneJid` em vez de `extractJid` no loop de `individualChats` (linhas 341-372) para que o `remote_jid` gravado no banco seja sempre o número real

3. Aplicar a mesma resolução no `findMessages` — o `where.key.remoteJid` precisa usar o JID original (`@lid`) para a API responder, mas o `remote_jid` salvo na tabela `messages` deve ser o número resolvido

**Arquivo: `deploy/backend/src/routes/webhook.ts`**

4. Na linha 104, quando `key.remoteJid` é `@lid`, verificar `key.participantAlt` e usar o número real. Isso garante que webhooks futuros também gravem o número correto

**Limpeza de duplicatas existentes** (via insert tool no banco):

5. Mover mensagens de conversations `@lid` para a conversation equivalente `@s.whatsapp.net` (mesmo user_id + instance_name), depois deletar a conversation `@lid` órfã

### Resultado
- `remote_jid` sempre será o número real (`@s.whatsapp.net`) quando disponível
- Sem mais duplicatas entre sync e webhook
- Conversas existentes com `@lid` serão limpas

