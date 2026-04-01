

# Plano: Dashboard Dinâmico com Dados Reais

## Problema
O dashboard atual é 100% estático com dados hardcoded. Não reflete nenhuma informação real do sistema.

## Solução
Criar um hook `useDashboardStats` que consulta as tabelas existentes e apresentar métricas reais com filtro de período.

## Alterações

### 1. Novo hook: `src/hooks/useDashboardStats.ts`
Consultas ao banco para obter:
- **Lembretes atrasados** — `reminders` onde `due_date < now()` e `completed = false`
- **Lembretes para hoje** — `reminders` onde `due_date` é hoje e `completed = false`
- **Lembretes no período** — total no range selecionado
- **Conversas no período** — count de `conversations` com `last_message_at` no range
- **Fluxos ativos** — count de `chatbot_flows` com `active = true`
- **Execuções no período** — count de `flow_executions` no range
- **Mensagens enviadas/recebidas** — count de `messages` no range, agrupado por `direction`
- **5 lembretes pendentes mais próximos** — `reminders` ordenado por `due_date`
- **5 conversas mais recentes** — `conversations` ordenado por `last_message_at`

Filtro de período: Hoje, Ontem, 7 dias, 30 dias, e date range picker customizado.

### 2. Reescrever: `src/pages/Dashboard.tsx`
- Importar e usar `useDashboardStats`
- **Header** com saudação pelo nome do usuário + seletor de período (botões + date picker)
- **4 stat cards** com dados reais:
  1. Lembretes Atrasados (badge vermelho)
  2. Conversas no Período
  3. Fluxos Ativos
  4. Mensagens Enviadas
- **Seção inferior** em grid 2 colunas:
  - **Próximos Lembretes** — lista dos 5 pendentes com nome do contato, título, data e badge de status (atrasado/hoje/futuro)
  - **Conversas Recentes** — lista das 5 mais recentes com nome, última mensagem e tempo relativo
- Remover dados hardcoded e a seção "Atalhos Rápidos"
- Loading skeleton enquanto carrega

### Estilo
- Cards com `rounded-xl`, ícones Lucide, sem emojis
- Badges semânticos: vermelho (atrasado), amarelo (hoje), cinza (futuro)
- Design limpo e profissional conforme padrão existente

