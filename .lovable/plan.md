

# Aprimorar Grupos WhatsApp — Layout profissional + padroes do whats-grupos

## Analise da referencia

O projeto `whats-grupos` utiliza:
- **Cards de campanha com gradiente no topo** e glow animado quando ativa
- **Sub-dialogos separados**: CampaignDialog (CRUD), CampaignMessagesDialog (mensagens agendadas com abas por tipo: Unico/Diario/Semanal/Mensal/Avancado), CampaignLeadsDialog (smart links + stats por grupo)
- **Switch inline** para ativar/desativar campanha no card
- **Badges com icones** (Zap/ZapOff para status, Radio para instancia)
- **Stats integrados no card**: contagem de grupos e mensagens
- **Acoes em botoes separados**: Editar, Mensagens, Leads, Excluir
- **Filtro por dia da semana** nas mensagens semanais
- **Tipos de mensagem expandidos**: texto, imagem, video, audio, sticker, localizacao, contato, enquete, lista
- **AlertDialog para confirmacao de exclusao**

## Mudancas planejadas

### 1. `src/pages/GruposPage.tsx` — Header sofisticado + nomes menores
- Titulo: "Grupos" (sem "WhatsApp")
- Subtitulo discreto: "Gerencie campanhas e monitore seus grupos"
- Nomes das abas mais curtos: "Visao Geral", "Selecao", "Campanhas", "Fila"

### 2. `src/components/grupos/GroupDashboardTab.tsx` — Layout profissional
- Usar `StatCard` pattern do projeto (icone em bg-muted + rounded-lg)
- Secoes com titulos menores e separadores
- Tabela de grupos com layout mais compacto
- Eventos com icones de cor no fundo, nao soltos

### 3. `src/components/grupos/GroupCampaignsTab.tsx` — Estilo da referencia
- Cards de campanha com gradiente no topo (2px) usando cor primaria
- Glow sutil quando campanha ativa
- Switch inline para toggle ativo/inativo
- Badge com icone Zap/ZapOff
- Stats inline (grupos, mensagens)
- Botoes de acao separados: "Editar", "Mensagens", "Excluir"
- Badge com nome da instancia + icone Radio
- AlertDialog para confirmacao de exclusao
- Botao "Nova Campanha" com gradiente primario + shadow glow

### 4. `src/components/grupos/GroupCampaignDialog.tsx` — Profissional
- DialogDescription adicionado
- Inputs com `bg-background/50 border-border/50 focus:border-primary/50`
- Icones nos labels (Megaphone, Radio, Users)
- Layout mais respirado

### 5. `src/components/grupos/GroupSelectorTab.tsx` — Polido
- Remover emoji de status (proibido pelo design system)
- Badge com cor para status (open = verde, closed = vermelho)
- Headers de secao mais compactos

### 6. `src/components/grupos/GroupQueueTab.tsx` — Polido
- Stats usando o pattern `StatCard` com icone em bg
- Tabela mais profissional com separadores
- Botoes com estilo consistente

### 7. `src/components/grupos/GroupMessageEditor.tsx` — Tipos expandidos
- Adicionar tipos: audio, sticker, localizacao, contato, enquete, lista (para paridade com referencia)
- Ou manter simplificado mas com visual melhorado

## Arquivos alterados
1. `src/pages/GruposPage.tsx`
2. `src/components/grupos/GroupDashboardTab.tsx`
3. `src/components/grupos/GroupCampaignsTab.tsx`
4. `src/components/grupos/GroupCampaignDialog.tsx`
5. `src/components/grupos/GroupSelectorTab.tsx`
6. `src/components/grupos/GroupQueueTab.tsx`
7. `src/components/grupos/GroupMessageEditor.tsx`

