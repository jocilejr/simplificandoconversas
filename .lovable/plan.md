

## Problema

Quando o sync-chats roda novamente, a Evolution API pode retornar o mesmo contato ora como `@lid`, ora como `@s.whatsapp.net`. Como o unique constraint é `(user_id, remote_jid, instance_name)`, um contato que já existe com telefone real cria uma duplicata quando retorna como `@lid` (e vice-versa).

## Solução: Campo `lid` na tabela conversations

Adicionar coluna `lid` (text, nullable) à tabela `conversations` para persistir o identificador @lid mesmo após o telefone ser resolvido. Isso permite cruzar referências durante o sync e o webhook.

```text
conversations
├── remote_jid      (chave principal - mantém o JID original, seja @lid ou @s.whatsapp.net)
├── phone_number    (número real quando resolvido)
├── lid             (NEW - armazena o JID @lid associado, mesmo quando remote_jid é telefone)
└── instance_name   (isolamento por instância)
```

## Alterações

### 1. Migration: Adicionar coluna `lid`

```sql
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS lid text;
```

Preencher retroativamente para conversas que já têm remote_jid como @lid:
```sql
UPDATE public.conversations SET lid = remote_jid WHERE remote_jid LIKE '%@lid' AND lid IS NULL;
```

### 2. `deploy/backend/src/routes/whatsapp-proxy.ts` — sync-chats (linhas 348-384)

Antes do upsert de cada chat, adicionar lógica de dedup:

- Se o chat vem como **@lid**: buscar conversa existente na mesma instância onde `lid = rawJid`. Se encontrar, fazer update em vez de criar nova.
- Se o chat vem como **@s.whatsapp.net**: buscar conversa existente na mesma instância onde `lid IS NOT NULL AND phone_number = número`. Se encontrar, atualizar o `remote_jid` para o telefone real e manter o `lid`.
- Sempre salvar o `lid` no campo novo quando o JID for @lid.

### 3. `deploy/backend/src/routes/webhook.ts` — resolver @lid (linhas 108-156)

Atualizar a lógica de resolução:
- Quando uma mensagem chega com @lid e o telefone é resolvido: salvar o `lid` na conversa.
- Quando uma mensagem chega com @s.whatsapp.net: buscar conversa existente onde `lid IS NOT NULL AND phone_number = número` na mesma instância, para evitar duplicata.
- Atualizar o campo `lid` no upsert data quando aplicável.

### 4. `deploy/backend/src/routes/whatsapp-proxy.ts` — send-message (linha 262)

Incluir `lid` no upsert de conversas ao enviar mensagens, se disponível.

### Resultado

- Re-sync nunca cria duplicatas: o sistema cruza @lid com telefone real por instância
- O campo `lid` persiste permanentemente, servindo como "ponte" entre os dois identificadores
- Isolamento por instância mantido: mesmo @lid em instâncias diferentes = conversas separadas

