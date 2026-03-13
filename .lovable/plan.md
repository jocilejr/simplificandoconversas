

## Diagnóstico: Mensagens "Aguardando mensagem" ainda não aparecem

### Análise

A correção no webhook está correta **para eventos que chegam**. O problema provável é que a **Evolution API (Baileys) não envia webhook** para mensagens que não conseguiu descriptografar. Se o Baileys não dispara `messages.upsert`, o webhook nunca recebe nada, e o contato nunca é criado no banco.

Isso explica por que o `update.sh` não resolveu — não é bug no código, é que o evento simplesmente não chega.

### Solução: Duas frentes

**1. Adicionar logging no webhook para confirmar a hipótese**

No início do handler (logo após receber o body), logar TODOS os eventos recebidos incluindo o `remoteJid`, para verificar se esses contatos estão ou não chegando:

```typescript
console.log("Webhook FULL:", JSON.stringify({
  event: body.event,
  instance: body.instance,
  remoteJid: body.data?.key?.remoteJid,
  fromMe: body.data?.key?.fromMe,
  hasMessage: !!body.data?.message,
  messageKeys: Object.keys(body.data?.message || {}),
  stubType: body.data?.messageStubType,
}));
```

**2. Sync de chats via Evolution API (solução definitiva)**

Criar um endpoint no backend que busca a lista de chats recentes da Evolution API e sincroniza com o banco. A Evolution API tem o endpoint `GET /chat/findChats/{instanceName}` que retorna todos os chats, incluindo os com mensagens não descriptografadas.

Esse sync pode ser chamado:
- Manualmente pelo usuário (botão "Sincronizar")
- Periodicamente (a cada 5 minutos)

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/webhook.ts` | Adicionar log detalhado no início |
| `deploy/backend/src/routes/sync-chats.ts` | **Novo** — endpoint que busca chats da Evolution API e sincroniza conversas |
| `deploy/backend/src/index.ts` | Registrar nova rota |
| `src/hooks/useConversations.ts` | Adicionar função de sync manual |
| `src/components/conversations/ConversationList.tsx` | Botão "Sincronizar conversas" |

### Recomendação

Sugiro primeiro aplicar apenas o **logging** e pedir para você verificar os logs do Docker (`docker logs backend`) quando uma mensagem "Aguardando" aparecer no WhatsApp. Isso confirma se o evento chega ou não, antes de implementar o sync completo.

Quer que eu implemente ambas as soluções de uma vez, ou primeiro só o logging para diagnóstico?

