

## Garantir que contatos apareçam mesmo sem mensagens

### Situação atual

O `sync-chats` já cria conversas sem exigir mensagens — se o `findChats` da Evolution retorna o contato, ele aparece. O problema é que o `findChats` **não retorna todos os contatos** (alguns só aparecem no WhatsApp Web mas não na resposta da API).

### Plano

#### 1. Adicionar `fetchContacts` como fonte complementar no sync-chats

**Arquivo:** `deploy/backend/src/routes/whatsapp-proxy.ts`

Após o loop de `findChats`, adicionar uma chamada ao endpoint `/chat/findContacts/{instance}` da Evolution API para buscar **todos os contatos** da agenda do WhatsApp. Para cada contato retornado que **não tenha conversa no banco**, criar uma conversa com:
- `remote_jid` do contato
- `contact_name` do contato
- `last_message: null`
- `last_message_at: now()`
- `phone_number` extraído do JID (se `@s.whatsapp.net`)

Isso garante que mesmo contatos sem mensagem apareçam na lista.

#### 2. Garantir que a UI exiba conversas sem mensagens corretamente

**Arquivo:** `src/components/conversations/ChatPanel.tsx`

Verificar que o estado vazio do chat (quando `messages` é array vazio) mostra uma mensagem amigável como "Nenhuma mensagem ainda" em vez de loading infinito ou tela em branco. (Provavelmente já funciona, mas confirmar.)

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/whatsapp-proxy.ts` | Adicionar `findContacts` como fonte complementar para criar conversas de contatos sem mensagem |

