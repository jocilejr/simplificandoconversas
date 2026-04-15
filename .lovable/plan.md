

# Scheduler Debug: Carrossel com Preview WhatsApp

## Problema Atual
- Layout em lista que sai da tela, sem filtragem correta por "hoje" no BRT
- Cards sem sentido, sem preview visual das mensagens
- Contagem de grupos monitorados incorreta (mostra 0)

## Solução

### 1. Backend — Expor dados completos para preview
**Arquivo:** `deploy/backend/src/routes/groups-api.ts`

- Além do `content_preview` (string), retornar o campo `content` completo (JSON) com `text`, `caption`, `mediaUrl`, `audioUrl`, etc. para alimentar o componente WhatsAppPreview
- Retornar também o total de grupos monitorados (`groups_count`) e total de grupos-alvo por mensagem (`target_groups_count`)

### 2. Frontend — Novo SchedulerDebugPanel completo em carrossel
**Arquivo:** `src/components/grupos/SchedulerDebugPanel.tsx` (reescrita total)

Layout:
- **Header**: Timers ativos, hora do servidor BRT, grupos monitorados, botão refresh
- **Carrossel horizontal** com scroll snap, navegação por setas
  - Cada card tem largura fixa (~320px), mostra:
    - Horário BRT grande no topo
    - Badge de tipo (text/image/video/audio)
    - Status (Timer ativo, Enviada, Falhou, Perdida)
    - **Preview WhatsApp** reutilizando o componente `WhatsAppPreview` existente com os dados do `content`
    - Contadores: X grupos enviados, Y falhas
    - Detalhes da fila (compacto) ao expandir
  - **Card focado** = próxima publicação futura (centralizado, borda highlight primary)
  - Cards passados à esquerda (opacidade reduzida, borda verde/vermelha conforme status)
  - Cards futuros à direita (borda neutra)
- **Rodapé**: Totais do dia (enviadas, falhas, perdidas)
- Filtra apenas mensagens de HOJE no BRT (já feito no backend, mas reforçar no frontend)

### 3. Hook — Atualizar tipos
**Arquivo:** `src/hooks/useSchedulerDebug.ts`

- Adicionar campo `content` (object) ao tipo `ScheduledMessageDebug`
- Adicionar `groups_count` ao `SchedulerDebugData`

### 4. GroupDashboardTab — Corrigir contagem de grupos
**Arquivo:** `src/components/grupos/GroupDashboardTab.tsx`

- Usar dados do scheduler debug para mostrar quantidade real de grupos monitorados quando `selectedGroups` estiver vazio (fallback para dados do backend)

## Pós-deploy
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose up -d --build backend
```

