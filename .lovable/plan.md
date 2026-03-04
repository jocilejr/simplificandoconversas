

## Analise

Dois problemas identificados:

### 1. Fluxo por palavra-chave não funciona
O webhook (`evolution-webhook`) recebe mensagens inbound, salva no banco, mas **nunca verifica se há fluxos ativos com gatilho de palavra-chave**. Não existe nenhuma lógica de matching — a mensagem é salva e nada mais acontece. Precisamos adicionar ao webhook a lógica de: ao receber mensagem inbound, buscar fluxos ativos do usuário, verificar se algum trigger tem `triggerKeyword` que coincide com o conteúdo da mensagem, e se sim, executar o fluxo automaticamente.

### 2. Indicador de não lidas na sidebar
O item "Conversas" na sidebar é estático. Precisa consultar conversas com `unread_count > 0` e exibir um badge/ponto verde.

---

## Plano

### 1. Webhook — auto-trigger de fluxos por keyword

No `evolution-webhook/index.ts`, após salvar a mensagem inbound, adicionar:

1. Buscar todos os fluxos ativos (`chatbot_flows` onde `active = true` e `user_id = userId`)
2. Para cada fluxo, percorrer os `nodes` procurando nós do tipo `trigger` (ou children com `type: 'trigger'`) que tenham `triggerKeyword`
3. Verificar se o conteúdo da mensagem contém ou é igual à keyword (case-insensitive)
4. Se match, verificar se já não há execução `running` para esse `remote_jid` + `flow_id` (evitar duplicatas)
5. Se não há execução ativa, invocar a edge function `execute-flow` via fetch interno, passando `flowId`, `remoteJid` e `conversationId`, usando o service role key para autenticação (já que o webhook roda server-side)

**Detalhe importante**: como o webhook usa `SUPABASE_SERVICE_ROLE_KEY`, a chamada ao `execute-flow` precisa ser adaptada. A forma mais simples: fazer a execução diretamente no webhook ao invés de chamar outra edge function — reutilizar a lógica de execução inline ou chamar via HTTP interno com um token válido.

Abordagem escolhida: **chamar execute-flow via HTTP** com o service role key no header Authorization, e ajustar `execute-flow` para aceitar um `userId` no body quando chamado com service role (para cenários server-to-server).

### 2. Ajuste no `execute-flow` — suporte a chamadas server-side

Adicionar suporte para quando o caller é o service role:
- Se o body contém `userId` e o token é o service role, usar esse `userId` diretamente
- Manter compatibilidade com chamadas do frontend (token do usuário)

### 3. Sidebar — indicador verde de não lidas

No `AppSidebar.tsx`:
- Adicionar query simples ao Supabase para contar conversas com `unread_count > 0`
- Usar realtime subscription na tabela `conversations` para atualizar automaticamente
- Exibir um ponto verde ao lado do ícone/texto "Conversas" quando há não lidas

### Arquivos impactados

- **Editar**: `supabase/functions/evolution-webhook/index.ts` (lógica de keyword matching + invoke execute-flow)
- **Editar**: `supabase/functions/execute-flow/index.ts` (suporte a chamadas server-side com userId)
- **Editar**: `src/components/AppSidebar.tsx` (indicador de não lidas com realtime)

