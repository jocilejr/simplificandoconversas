

## Problemas Identificados

### 1. Erro "Já existe um fluxo ativo" -- falso positivo

**Causa raiz:** A edge function `execute-flow` verifica fluxos ativos por `user_id` + `remote_jid` (linha 354-355), ou seja, busca em TODAS as instâncias. Porém, o painel lateral (`useFlowExecutions`) filtra apenas pelo `conversation_id` atual. Resultado: existe um fluxo ativo para o mesmo número em outra instância (ex: "Meire Rosana - Entregas"), mas o painel da conversa "FunilPrincipal" não mostra porque filtra só pela conversation_id local.

**Correção:** Adicionar filtro por `instance_name` na verificação de fluxo ativo no `execute-flow`, para que a checagem seja por instância e não global. A query passará a usar `.eq("instance_name", evolution_instance_name)` junto com `user_id` e `remote_jid`.

**Arquivo:** `supabase/functions/execute-flow/index.ts` (linhas 351-357)

### 2. Conteúdo do painel lateral saindo da box

**Causa raiz:** URLs longas no histórico de mensagens não quebram linha, forçando o container a expandir além dos 340px.

**Correção:** Adicionar `break-all` ou `overflow-hidden` nas mensagens do histórico e no container principal.

**Arquivo:** `src/components/conversations/RightPanel.tsx`

---

### Alterações técnicas

1. **`supabase/functions/execute-flow/index.ts`**: Na query de bloqueio (linha 351), adicionar `.eq("instance_name", evolution_instance_name)` para isolar a verificação por instância. Também precisamos garantir que `instance_name` está sendo salvo na `flow_executions` -- verificar se o campo existe.

2. **`src/components/conversations/RightPanel.tsx`**: Adicionar `break-all` na classe do `<p>` de conteúdo das mensagens (linha 176) e `overflow-hidden` no container principal.

