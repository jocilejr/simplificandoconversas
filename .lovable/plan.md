

## Problema: 1 dos 2 contatos "Aguardando mensagem" não aparece no app

### Causa

O `lightSync()` usa o endpoint `findChats` da Evolution API, que **nem sempre retorna todos os chats com mensagens não descriptografadas**. A API pode não incluir chats que ainda estão pendentes de troca de chaves. Resultado: um contato aparece, o outro não.

Além disso, o light-sync apenas **cria** conversas novas — se o `findChats` não retornar o chat, ele simplesmente não será criado.

### Solução

Complementar o `findChats` com o endpoint `findContacts` da Evolution API no light-sync. O `findContacts` retorna **todos os contatos** conhecidos pela instância, incluindo aqueles cujas mensagens ainda não foram descriptografadas. Para cada contato encontrado em `findContacts` que não tenha conversa no banco, criamos a conversa.

### Mudanças

#### `deploy/backend/src/routes/light-sync.ts`
- Após processar `findChats`, fazer uma chamada adicional a `/chat/findContacts/{instance}` 
- Para cada contato individual retornado (`@s.whatsapp.net` ou `@lid`) que **não** tenha conversa no banco, criar a conversa com placeholder
- Adicionar log detalhado: quantos contatos foram encontrados via `findContacts` e quantos eram novos
- Isso garante cobertura completa: `findChats` pega chats com histórico, `findContacts` pega contatos que o `findChats` pode ter ignorado

