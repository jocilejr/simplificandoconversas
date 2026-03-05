

## Diagnóstico

Analisei o banco de dados e os logs do webhook em detalhe:

**Conversas de hoje no banco:**
- `558981340810` (J Júnior / ".") — existe no FunilPrincipal
- `5511965203557` (Cristiane) — existe no FunilPrincipal  
- `551899735-7095` — **NÃO existe no banco**

**Causa raiz:** O webhook nunca recebeu o evento `messages.upsert` para o número +55 18 99735-7095. Os logs do webhook mostram apenas eventos `messages.update` e `send.message` recentes — nenhum `messages.upsert` para esse contato. Isso indica que a Evolution API não disparou o evento de nova mensagem para esse contato específico (pode ser uma falha temporária de conexão ou um problema no lado da Evolution).

**Por que a sincronização manual também não resolve:**
A função `sync-chats` busca apenas 150 mensagens (3 páginas de 50) via `findMessages`. Se a mensagem desse contato não estiver nessas 150 mais recentes, ela é ignorada. Além disso, o filtro "Inbound Only" descarta conversas sem mensagens recebidas nas páginas carregadas.

## Plano de Correção

### 1. Aumentar cobertura do sync-chats
- Aumentar `MAX_PAGES` de 3 para 5 (250 mensagens) para capturar mais conversas recentes
- Adicionar fallback: após o `findMessages`, também chamar `findChats` para pegar conversas que não apareceram nas mensagens paginadas, criando as que faltam

### 2. Combinar findMessages + findChats (abordagem híbrida)
Atualmente, `findChats` só é usado se `findMessages` retorna 0 resultados. A correção fará com que `findChats` seja sempre chamado como complemento, criando conversas que existem nos chats mas não foram capturadas pelas mensagens paginadas.

### Arquivos alterados
- `supabase/functions/evolution-proxy/index.ts` — lógica de `sync-chats`: aumentar páginas e adicionar findChats como complemento

### Limitação conhecida
Se a Evolution API simplesmente não disparou o webhook, não há como o sistema saber da mensagem em tempo real. A sincronização manual corrigirá essas lacunas após a implementação.

