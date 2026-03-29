

## Dashboard Dinâmico com Filtro de Datas

### Visão Geral
Substituir o dashboard estático por um com dados reais do banco, com seletor de período: **Hoje**, **Ontem**, **Personalizado** (date range picker).

### Seletor de Período (topo do dashboard)
Botões segmentados: `Hoje | Ontem | Personalizado`
- Ao selecionar "Personalizado", abre um date range picker (Popover + Calendar)
- O período selecionado filtra todos os cards e listas

### Cards de Estatísticas
| Card | Query | Comparação |
|------|-------|------------|
| Lembretes no Período | `reminders` com `due_date` no range | Pendentes vs concluídos |
| Lembretes Atrasados | `reminders` pendentes com `due_date` < início do range | Total |
| Conversas no Período | `conversations` com `last_message_at` no range | Total |
| Fluxos Ativos | `chatbot_flows` com `active = true` | Sempre atual |
| Execuções no Período | `flow_executions` criadas no range | Total |
| Mensagens no Período | `messages` criadas no range | Enviadas vs recebidas |

### Seções Inferiores
1. **Lembretes Pendentes** -- Até 5 lembretes com `due_date` no range ou atrasados, com badge (hoje/atrasado/futuro), nome do contato e título
2. **Conversas Recentes** -- Últimas 5 conversas com `last_message_at` no range, mostrando nome, telefone e horário

### Implementação

1. **Criar `src/hooks/useDashboardStats.ts`**
   - Recebe `startDate` e `endDate` como parâmetros
   - 6 queries paralelas usando `useQuery` com as tabelas existentes (`reminders`, `conversations`, `chatbot_flows`, `flow_executions`, `messages`)
   - Retorna contagens + listas dos 5 mais recentes

2. **Reescrever `src/pages/Dashboard.tsx`**
   - State para período: `"today" | "yesterday" | "custom"` + `dateRange`
   - Barra de filtro no topo com botões segmentados + date picker (Popover + Calendar com `mode="range"`)
   - Cards dinâmicos consumindo o hook
   - Seções inferiores com dados reais
   - Loading skeletons enquanto carrega

Nenhuma alteração de schema necessária -- usa tabelas existentes.

