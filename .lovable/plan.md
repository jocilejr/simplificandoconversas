

## Plano: 3 alterações

### 1. Histórico de mensagens — mostrar apenas recebidas

**Arquivo:** `src/hooks/useMessages.ts` (linha 30)

Adicionar filtro `.eq("direction", "inbound")` na query para retornar apenas mensagens recebidas.

### 2. PDF enviado como "arquivo" em vez de PDF

**Arquivo:** `supabase/functions/execute-flow/index.ts` (linha 182)

O `sendFile` envia com `mediatype: "document"` mas não inclui o campo `mimetype`. A Evolution API precisa de `mimetype: "application/pdf"` para que o WhatsApp renderize como PDF e não como arquivo genérico.

Alteração: adicionar `mimetype: "application/pdf"` no body do fetch quando o fileName terminar em `.pdf`.

### 3. Respostas rápidas — ativar com "/" em vez de botão na sidebar

**Arquivo:** `src/components/conversations/ChatPanel.tsx`

- Remover o botão `<Zap>` e o `<Popover>` de respostas rápidas (linhas 322-350)
- Adicionar estado `showQuickReplies` que fica `true` quando o texto começa com `/`
- Renderizar um dropdown flutuante acima do input (posição absolute) que filtra as respostas pelo texto após `/`
- Ao selecionar uma resposta, substituir o texto inteiro pelo conteúdo da resposta e fechar o dropdown

