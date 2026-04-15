

# Plano: Filtro de busca no painel de Publicações

## O que será feito
Adicionar um campo de busca (com ícone de lupa) no header do `SchedulerDebugPanel` que filtra as programações em tempo real conforme o usuário digita. A busca vai considerar: nome da campanha, tipo de mensagem (label), conteúdo/preview do texto, status e tipo de agendamento.

## Alterações

### `src/components/grupos/SchedulerDebugPanel.tsx`
1. Importar `Search` do Lucide e `Input` do UI
2. Adicionar estado `searchTerm` no componente principal
3. Adicionar um `Input` com ícone de lupa no header, ao lado do título "Publicações de Hoje"
4. Criar um `filtered` memo que aplica o filtro sobre `sorted`:
   - Busca case-insensitive em: `campaign_name`, `content_preview`, `content.text`, `content.caption`, `status_label`, `typeLabels[message_type]`, `scheduleLabels[schedule_type]`
5. Substituir todas as referências a `sorted` por `filtered` no carrossel (navegação, dots, prev/current/next)
6. Resetar `activeIndex` para 0 quando `searchTerm` mudar

### UX
- Input compacto (h-7, text-xs) para não ocupar muito espaço no header
- Placeholder: "Buscar programação..."
- O input aparece ao lado dos dots e do botão refresh
- Quando não há resultado, mostra mensagem "Nenhuma publicação encontrada"

