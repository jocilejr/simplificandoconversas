

## Disparo manual de fluxo pela Sidebar

### O que será criado

Um botão "Disparar Fluxo" na sidebar (entre Menu e Sistema) que abre um Dialog com 3 campos:
1. **Número** — input de telefone (ex: 5588999999999)
2. **Fluxo** — select com os fluxos ativos do usuário (da tabela `chatbot_flows`)
3. **Instância** — select com as instâncias do usuário (da tabela `evolution_instances`)

Ao clicar "Disparar", invoca a edge function `execute-flow` com `{ flowId, remoteJid, instanceName }`.

### Arquivos

1. **Novo: `src/components/ManualFlowTrigger.tsx`**
   - Componente Dialog com os 3 campos
   - Usa `useChatbotFlows()` para listar fluxos
   - Usa `useEvolutionInstances()` para listar instâncias
   - Chama `supabase.functions.invoke("execute-flow", { body: { flowId, remoteJid, instanceName } })` ao submeter
   - Exibe toast de sucesso/erro

2. **Editar: `src/components/AppSidebar.tsx`**
   - Adicionar botão com ícone `Send` (lucide) na seção "Sistema", acima de Configurações
   - Ao clicar, abre o Dialog do `ManualFlowTrigger`
   - Respeita estado collapsed (mostra só ícone)

### Fluxo de execução

```text
Sidebar [Disparar Fluxo] → Dialog (número + fluxo + instância) → execute-flow edge function → mensagens enviadas
```

O endpoint `execute-flow` já aceita `instanceName` no body e resolve tudo automaticamente (conversa, execução, etc).

