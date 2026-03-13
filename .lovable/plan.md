

## Correção do Light-Sync e Tratamento de Mensagens Não Descriptografadas

### Problema Principal

O `lightSync()` em `deploy/backend/src/routes/light-sync.ts` linha 26 filtra por `.eq("is_active", true)`, mas as instâncias no banco têm `is_active = false` (valor default). Resultado: a query retorna zero instâncias, a função sai silenciosamente na linha 28, e nenhum log aparece.

### Sobre a descriptografia

A descriptografia de mensagens do WhatsApp depende da troca de chaves entre o celular e o servidor (Evolution API). Quando o celular está offline ou a troca de chaves falha, a mensagem fica como "Aguardando mensagem". O sistema **não pode** forçar a descriptografia — isso é uma limitação do protocolo WhatsApp. O que podemos fazer é:

1. **Capturar o contato imediatamente** mesmo sem conteúdo descriptografado
2. **Re-verificar periodicamente** se a mensagem foi descriptografada (o celular precisa ficar online)

### Mudanças

#### 1. `deploy/backend/src/routes/light-sync.ts`
- Remover filtro `.eq("is_active", true)` — buscar todas as instâncias
- Verificar conexão via Evolution API (`connectionState`) em vez de flag do banco
- Adicionar logs de início/fim para confirmar execução
- Adicionar log de summary mesmo quando zero conversas novas

#### 2. `deploy/backend/src/routes/webhook.ts`
- Tratar eventos `messages.upsert` com `messageStubType` (mensagens sem conteúdo) criando a conversa com placeholder
- Não pular mensagens vazias de contatos individuais

#### 3. `src/components/conversations/ConversationList.tsx`
- Confirmar que busca por `phone_number` já está incluída (feito anteriormente)

### Resultado Esperado

Após deploy:
- `docker logs deploy-backend-1 --tail 50 2>&1 | grep "light-sync"` mostrará logs a cada 5 min
- Conversas com mensagens não descriptografadas aparecerão na app automaticamente

