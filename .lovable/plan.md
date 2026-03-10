

## Problemas identificados

1. **LID exibido como nome**: Quando `contact_name` é null, o fallback `formatJid` mostra o número LID bruto (ex: `71970901237963`) em vez do telefone real. LIDs não são números de telefone -- são IDs internos do WhatsApp.

2. **Conversa duplicada sem mensagens**: O mesmo contato `@lid` foi sincronizado em duas instâncias (`ads` e `llo`). Na instância `llo`, a conversa foi criada mas não tem mensagens porque a Evolution API pode não ter o histórico completo para esse `@lid` nessa instância.

## Solução

### Parte 1: Resolver LID → telefone no sync-chats

No `deploy/backend/src/routes/whatsapp-proxy.ts`, antes do loop de sync, buscar `findContacts` para cada instância e construir um mapa de participantes. Para contatos `@lid`, tentar resolver o telefone real usando:

1. **Campo `participantAlt`** do `findContacts` (se existir)
2. **Buscar mensagens do chat** e extrair `participantAlt` de alguma mensagem que tenha esse campo
3. Se não resolver, **pular o contato `@lid`** -- ele será criado automaticamente quando chegar uma mensagem via webhook com `participantAlt` contendo o telefone real

Isso elimina completamente `@lid` do banco de dados.

### Parte 2: Webhook -- resolver antes de salvar

No `deploy/backend/src/routes/webhook.ts`, manter a lógica atual de resolução via `participantAlt` (linhas 108-120), mas adicionar uma segunda tentativa: buscar no campo `data.participant` ou `data.remoteJid` alternativas. Se o `@lid` continuar sem resolver, **pular** em vez de salvar.

### Parte 3: Limpar dados existentes

O usuário precisará rodar na VPS:
```bash
docker compose exec postgres psql -U postgres -d postgres -c "DELETE FROM messages; DELETE FROM conversation_labels; DELETE FROM conversations;"
```

### Arquivos alterados
- `deploy/backend/src/routes/whatsapp-proxy.ts` -- no sync-chats, buscar mensagens de cada contato `@lid` para extrair `participantAlt` e resolver para telefone real; pular se não resolver
- `deploy/backend/src/routes/webhook.ts` -- manter resolução atual, garantir que `@lid` não resolvido seja pulado

### Resultado esperado
- Todas as conversas terão `remote_jid` com `@s.whatsapp.net` (telefone real)
- Nomes exibidos serão o `pushName` do contato ou o número de telefone formatado
- Zero duplicatas por LID vs telefone

