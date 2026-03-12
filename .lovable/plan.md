

## Problema

A logica atual tenta **substituir** o `remote_jid` de `@lid` para `@s.whatsapp.net`, causando duplicacoes quando o sync roda novamente (a Evolution retorna `@lid` mas o banco ja tem `@s.whatsapp.net`).

## Estrategia Correta

- `remote_jid` = manter **exatamente** o que a Evolution envia (nunca transformar)
- `lid` = armazenar o valor `@lid` quando presente
- `phone_number` = armazenar o telefone resolvido (via senderPn, remoteJidAlt, etc.)
- O `@lid` e o identificador estavel — ele nunca muda e evita duplicacoes no re-sync

## Alteracoes

### 1. `deploy/backend/src/routes/webhook.ts` — Parar de migrar remote_jid

**Linhas 171-176**: Remover a logica que faz `update({ remote_jid: remoteJid })` trocando de @lid para phone. Em vez disso, apenas atualizar `phone_number` na conv existente e usar o `remote_jid` original da conv (que e @lid).

**Linhas 143-158**: Quando webhook recebe `@lid`, buscar por `lid` e usar a conv encontrada — OK, ja funciona. Mas parar de reatribuir `remoteJid` para o valor da conv (manter o @lid original).

**Linhas 159-180**: Quando webhook recebe `@s.whatsapp.net`, buscar conv que tenha o mesmo `phone_number` OU buscar por `contact_name` na mesma instancia. Se encontrar, usar essa conv (sem alterar `remote_jid`). Apenas setar `phone_number` se ainda nao tiver.

### 2. `deploy/backend/src/routes/whatsapp-proxy.ts` — sync-chats dedup

**Linhas 403-415**: Remover a logica que troca `remote_jid` de @lid para phone (linha 413-415). Quando um chat `@s.whatsapp.net` encontra uma conv `@lid` existente, apenas atualizar `phone_number` e `contact_name` — **sem** alterar `remote_jid`.

**Linhas 384-398**: Quando chat `@s.whatsapp.net` chega no sync, alem de buscar por `phone_number`, tambem buscar por `contact_name` + `instance_name` para encontrar convs `@lid` que ainda nao tem `phone_number` preenchido.

### 3. `deploy/backend/src/routes/webhook.ts` — Upsert de conversa

**Linhas ~230-260**: No upsert da conversa via webhook, quando o JID e `@lid`, garantir que o campo `lid` e preenchido. Quando e `@s.whatsapp.net` e ja existe uma conv com o mesmo `phone_number`, usar a conv existente em vez de criar nova.

### Resultado

- Sync cria convs com `remote_jid=@lid`, `lid=@lid`, `phone_number=resolvido`
- Re-sync encontra a conv pelo `lid` e atualiza — zero duplicatas
- Webhook com `@s.whatsapp.net` encontra a conv pelo `phone_number` e adiciona mensagem na conv certa
- Webhook com `@lid` encontra a conv pelo `lid` diretamente
- `remote_jid` nunca e transformado

