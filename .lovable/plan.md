## Plano: Campo `phone_number` separado + busca inteligente no webhook

### Conceito

O `remote_jid` passa a ser apenas o **identificador único** do contato (seja `@lid` ou `@s.whatsapp.net`). Um novo campo `phone_number` armazena o telefone real quando disponível. O webhook, ao receber  uma mensagem, busca o contato existente antes de criar um novo, e atualiza o `phone_number` quando conseguir resolver.

### Alterações

**1. Migração: adicionar coluna `phone_number` na tabela `conversations**`

```sql
ALTER TABLE conversations ADD COLUMN phone_number text;
-- Popular phone_number para conversas existentes com @s.whatsapp.net
UPDATE conversations 
SET phone_number = split_part(remote_jid, '@', 1)
WHERE remote_jid LIKE '%@s.whatsapp.net';
```

**2. `deploy/backend/src/routes/whatsapp-proxy.ts` (sync-chats)**

No upsert da conversa, adicionar `phone_number`:

- Se o JID é `@s.whatsapp.net` → `phone_number = número extraído do JID`
- Se o JID é `@lid` → `phone_number = null` (será preenchido via webhook)

**3. `deploy/backend/src/routes/webhook.ts**`

Substituir a lógica atual de "migração de remote_jid" por uma abordagem de **busca e atualização**:

- Quando chega uma mensagem com `@lid` e consegue resolver para telefone via `senderPn`/`remoteJidAlt`/`participantAlt`:
  1. Buscar conversa existente com `remote_jid = originalLid` (mesma instância/user)
  2. Se encontrar → atualizar `phone_number` nessa conversa, registrar a mensagem nela
  3. Remover toda a lógica de migração de `remote_jid` (linhas 124-198) — o `remote_jid` nunca muda
- Quando chega uma mensagem com `@s.whatsapp.net`:
  1. Buscar conversa existente com `remote_jid = jid` OU `phone_number = número`
  2. Se encontrar por `phone_number` (era um `@lid`) → usar essa conversa existente
  3. Se não encontrar → criar normalmente
- No upsert de conversa, incluir `phone_number` quando disponível

**4. UI — 3 componentes**

`src/components/conversations/RightPanel.tsx`:

- Helper `isLidJid(jid)` para detectar `@lid`
- Se tem `phone_number` → mostrar ícone Phone + número formatado
- Se não tem (é `@lid` sem resolução) → mostrar ícone Hash + "ID do Usuário" com o número bruto
- Quando `phone_number` for preenchido via webhook, a UI atualiza automaticamente (polling de 3s)

`src/components/conversations/ChatPanel.tsx`:

- No subtítulo do header: mostrar `phone_number` formatado se disponível, senão mostrar o JID bruto sem formatação de telefone

`src/components/conversations/ConversationList.tsx`:

- Quando não tem `contact_name`: mostrar `phone_number` formatado se disponível, senão mostrar o número LID bruto (sem formatação de telefone)

**5. Tipo `Conversation` em `useConversations.ts**`

Adicionar `phone_number: string | null` ao tipo e garantir que o `select("*")` já traz o campo.

### Arquivos alterados

- Migração SQL (nova coluna `phone_number`)
- `deploy/backend/src/routes/whatsapp-proxy.ts` — sync com phone_number
- `deploy/backend/src/routes/webhook.ts` — busca inteligente + update phone_number (remover migração de remote_jid)
- `src/hooks/useConversations.ts` — tipo atualizado
- `src/components/conversations/RightPanel.tsx` — exibição condicional
- `src/components/conversations/ChatPanel.tsx` — subtítulo condicional

`src/components/conversations/ConversationList.tsx` — nome fallback condicional  
  
6. Adicionar botão para deletar todas as conversas presentes do chat na aba de configurações > instancias.  
  
   Deve conter um botão na area de configurações onde ao apertar eu deleto todos os chats presentes nos "chats". Essa funcionalidade vai servir para importar novas conversas e futuras atualizações.