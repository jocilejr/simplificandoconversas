

# Plano: Mover busca para Programação e filtrar por campanha na Visão Geral

## Mudanças

### 1. SchedulerDebugPanel — Remover busca, adicionar filtro por campanha

**Arquivo:** `src/components/grupos/SchedulerDebugPanel.tsx`

- Remover o campo `<Input>` de busca e o state `searchTerm`
- Adicionar um `<Select>` (ou botões) de filtro por campanha:
  - Opção padrão: **"Todos"** — mostra todas as publicações de todas as campanhas ativas
  - Cada campanha ativa aparece como opção
- Usar `useGroupCampaigns()` para buscar as campanhas disponíveis
- Filtrar `sorted` pelo `campaign_name` selecionado (ou mostrar tudo se "Todos")

### 2. GroupMessagesDialog — Adicionar busca por texto

**Arquivo:** `src/components/grupos/GroupMessagesDialog.tsx`

- Adicionar um campo `<Input>` com ícone de `Search` no topo da área de conteúdo (acima das tabs de tipo de agendamento)
- Filtrar `displayMessages` pelo texto digitado, comparando com:
  - `content.text`, `content.caption`, `content.question`, `content.title`
  - Preview gerado por `getPreview()`
- Busca case-insensitive

## Detalhes técnicos

- O filtro de campanha no SchedulerDebugPanel usa o campo `msg.campaign_name` que já existe nos dados do scheduler-debug
- Componente Select do shadcn/ui já disponível no projeto
- Nenhuma mudança no backend

