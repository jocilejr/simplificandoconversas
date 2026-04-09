

# Melhorias na Página de Leads

## 1. Ordenação por colunas na tabela

Adicionar ordenação crescente/decrescente ao clicar nos cabeçalhos da tabela (Nome, Telefone, Pedidos, Total Pago, Agend., Status).

- Clicar uma vez: ordem crescente
- Clicar novamente: ordem decrescente
- Ícone de seta indicando direção atual
- Estado controlado via `useState` no componente `Leads.tsx`
- A ordenação é aplicada no array `filtered` já existente no hook, ou localmente no componente

**Arquivo:** `src/pages/Leads.tsx`

## 2. Redesign do LeadDetailDialog com cards por instância

Substituir a seção confusa de "Últimas Mensagens" por um layout com cards organizados por seção:

### Estrutura do dialog redesenhado:

```text
┌─────────────────────────────────────────┐
│ 👤 Nome do Lead                         │
│ Status: ✅ Pagou | R$ 1.500,00          │
├─────────────────────────────────────────┤
│ Dados Pessoais (nome, tel, doc, email)  │
├─────────────────────────────────────────┤
│ 💳 Pagamentos         (card expansível) │
│   Transações pagas e pendentes          │
├─────────────────────────────────────────┤
│ 🔔 Agendamentos       (card expansível) │
│   Lista de reminders                    │
├─────────────────────────────────────────┤
│ 💬 Histórico de Conversas              │
│  ┌──────────┐ ┌──────────┐             │
│  │ Instance1│ │ Instance2│  (cards)     │
│  └──────────┘ └──────────┘             │
│                                         │
│  Ao clicar em um card de instância:     │
│  ┌─────────────────────────────────┐    │
│  │ ScrollArea com TODAS as msgs    │    │
│  │ daquela instância (scroll)     │    │
│  │ ...                            │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Como funciona:

- Buscar todas as conversations do lead (mesmo `remote_jid`) no workspace, agrupando por `instance_name`
- Cada instância vira um card clicável mostrando: nome da instância, quantidade de mensagens, última mensagem
- Ao clicar num card, expandir abaixo dele um `ScrollArea` com **todas** as mensagens daquela conversation (sem limite de 10), permitindo scroll com a bolinha do mouse
- Remover o limite `.limit(10)` atual da query de mensagens -- buscar por `conversation_id` da instância selecionada

### Queries necessárias:

1. Buscar conversations do lead: `conversations` WHERE `remote_jid = lead.remote_jid` AND `workspace_id`
2. Buscar mensagens da conversation selecionada: `messages` WHERE `conversation_id = X` ORDER BY `created_at ASC` (sem limit, ou limit alto como 500)

## Detalhes técnicos

### Arquivos modificados:

1. **`src/pages/Leads.tsx`** -- Adicionar estado de ordenação (`sortField`, `sortDir`), cabeçalhos clicáveis com ícones de seta, lógica de sort no array `leads`

2. **`src/hooks/useLeads.ts`** -- Adicionar `instances` ao tipo `Lead` (array de `{instance_name, conversation_id}`). Coletar todas as conversations por `remote_jid` em vez de pegar só a primeira

3. **`src/components/leads/LeadDetailDialog.tsx`** -- Redesenhar com:
   - Query para buscar conversations do lead (agrupadas por instância)
   - Cards clicáveis por instância
   - Estado `selectedConversationId` para controlar qual histórico está expandido
   - Query de mensagens por `conversation_id` (sem limit de 10)
   - `ScrollArea` com altura fixa (~400px) para scroll do histórico completo
   - Manter seções de dados pessoais, pagamentos e agendamentos como cards separados

