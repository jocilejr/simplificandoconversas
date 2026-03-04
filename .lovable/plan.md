

## Diagnóstico: FunilPrincipal sem mensagens

### Causa raiz identificada nos logs

Os logs mostram claramente que a **Evolution API não retorna nenhuma mensagem** para a instância FunilPrincipal:

```text
findMessages FunilPrincipal status: 200, body length: 63
→ {"messages":{"total":0,"pages":0,"currentPage":1,"records":[]}}

findChats FunilPrincipal status: 200, body length: 2
→ []
```

A API responde com sucesso (status 200), mas retorna **0 mensagens e 0 chats**. Isso não é um bug no código — a Evolution API simplesmente não tem dados armazenados para essa instância.

### Possíveis causas

1. **Webhook não configurado** para FunilPrincipal — sem webhook, mensagens em tempo real não chegam E o histórico pode não ser armazenado pela API
2. **Instância desconectada** — se o status não é "open", a API não recebe/armazena mensagens
3. **Store desabilitado** na instância — a Evolution API pode estar configurada para não persistir mensagens

### Correções propostas

#### 1. Forçar reconfiguração do webhook para FunilPrincipal
Ao sincronizar, verificar se o webhook está ativo para cada instância e reconfigurá-lo automaticamente se necessário. O código de `sync-webhooks` já faz isso, mas não é chamado durante o `sync-chats`.

**Arquivo:** `supabase/functions/evolution-proxy/index.ts`
- No início do `sync-chats`, antes de buscar mensagens, chamar o endpoint `webhook/set` para cada instância (garantindo que mensagens futuras cheguem via webhook)

#### 2. Verificar e exibir status de conexão por instância
Adicionar uma verificação de `connectionState` durante o sync para informar ao usuário se a instância está realmente conectada.

**Arquivo:** `supabase/functions/evolution-proxy/index.ts`
- Chamar `/instance/connectionState/{instanceName}` para cada instância durante o sync
- Retornar o status no resultado para que o usuário saiba se FunilPrincipal está "open" ou "close"

#### 3. Tentar habilitar o store da instância
Chamar o endpoint de configuração do store (`/chat/updateSettings`) para garantir que as mensagens são persistidas pela Evolution API.

**Arquivo:** `supabase/functions/evolution-proxy/index.ts`

### Resumo das alterações
- Modificar o `sync-chats` para: (1) verificar conexão, (2) configurar webhook, (3) habilitar store de mensagens — tudo antes de buscar dados
- Retornar informações de status por instância no resultado do sync para feedback ao usuário

