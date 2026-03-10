

## Diagnóstico Real

### Problema 1: `findChats` é um endpoint bugado na Evolution API v2.3.x

Pesquisando a documentação e issues do GitHub da Evolution API, encontrei **bugs conhecidos e confirmados**:

- **Issue #2051**: A tabela `Chat` parou de criar novas entradas desde setembro 2025, especialmente para contatos no formato `@lid`. Isso faz `findChats` retornar `[]` mesmo com todas as configs corretas.
- **Issue #1376**: `findChats` não traz chats de contatos não salvos.
- **Issue #2041**: `findChats` retorna erro 500 em certas versões.

**O endpoint `findChats` simplesmente não funciona de forma confiável na v2.3.7.** Nenhuma configuração vai resolver isso.

### Problema 2: Tentativas de Realtime WebSocket causam overhead

Os hooks ainda tentam conectar ao Supabase Realtime (que não existe na VPS), gerando timeouts e atrasos antes do polling assumir.

---

## Plano de Correção

### 1. Reescrever sync-chats usando `findContacts` + `findMessages`

Em vez de depender do bugado `findChats`, usar `findContacts` que **funciona** (confirmado nas issues) para descobrir os contatos, e depois `findMessages` para importar as mensagens de cada um.

**Arquivo**: `deploy/backend/src/routes/whatsapp-proxy.ts` (case `sync-chats`)

Fluxo novo:
1. Chamar `/chat/findContacts/{instance}` (POST, body `{}`)
2. Filtrar apenas contatos individuais (excluir `@g.us`, `status@broadcast`)
3. Para cada contato, chamar `/chat/findMessages/{instance}` com `{ where: { key: { remoteJid } }, limit: 50 }`
4. Criar/atualizar conversation + inserir mensagens (dedup por `external_id`)

### 2. Remover Supabase Realtime dos hooks

**Arquivos**: `src/hooks/useMessages.ts` e `src/hooks/useConversations.ts`

Remover os `useEffect` com `supabase.channel(...)` e os `useRef(realtimeFailed)`. Manter apenas polling puro (2s mensagens, 3s conversas).

### 3. Adicionar botão "Sincronizar" na UI de conexões

**Arquivo**: `src/components/settings/ConnectionsSection.tsx`

Adicionar um botão "Sincronizar" nas instâncias conectadas (status `open`) que chama `sync-chats` e mostra o resultado (número de conversas e mensagens importadas).

