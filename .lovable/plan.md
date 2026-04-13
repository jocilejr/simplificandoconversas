

## Plano: Refinamento Visual da Página de Grupos

### Problema
As abas da página de Grupos possuem títulos redundantes dentro de cada tab (o título já está nas abas), layout genérico sem identidade visual, e não seguem o padrão profissional do restante da aplicação (tema escuro com acentos dourados #c5a55a).

### Mudanças

#### 1. `GruposPage.tsx` — Header e Tabs refinados
- Remover o header com ícone e título grandes (redundante com a sidebar)
- Usar TabsList com estilo mais refinado: fundo escuro sólido, indicador dourado, ícones em cada aba
- Adicionar ícones contextuais em todas as abas (LayoutDashboard, Megaphone, ListOrdered, Link2)

#### 2. `GroupDashboardTab.tsx` — Remover título interno
- Remover qualquer header/título redundante (já está na aba "Visão Geral")
- Manter apenas os StatCards e os Cards de conteúdo
- Usar bordas sutis com `border-border/50` e backgrounds `bg-card/50`

#### 3. `GroupCampaignsTab.tsx` — Limpar header interno
- Remover o mini-header "Campanhas" / subtítulo (redundante com a aba)
- Manter apenas o botão "Nova Campanha" alinhado à direita no topo
- Cards de campanha já estão bons, manter o estilo com barra gradiente

#### 4. `GroupQueueTab.tsx` — Limpar headers internos
- Remover títulos redundantes dos Cards internos ou simplificar
- Manter os StatCards e o conteúdo funcional

#### 5. `GroupSmartLinkTab.tsx` — Limpar header interno
- Remover mini-header "Smart Links" / subtítulo (redundante com a aba)
- Manter apenas o botão "Novo Smart Link" alinhado à direita
- Na view de detalhe, refinar os cards de stats com ícones dourados

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/GruposPage.tsx` | Refinar header e TabsList com ícones e estilo profissional |
| `src/components/grupos/GroupDashboardTab.tsx` | Remover títulos redundantes |
| `src/components/grupos/GroupCampaignsTab.tsx` | Remover header redundante, manter botão |
| `src/components/grupos/GroupQueueTab.tsx` | Limpar headers internos |
| `src/components/grupos/GroupSmartLinkTab.tsx` | Limpar header redundante, refinar cards |

### Estilo aplicado
- Cores: fundo escuro (#111b21), acentos dourados (#c5a55a / `hsl(var(--primary))`)
- Sem emojis, apenas ícones Lucide
- Tabs com indicador ativo dourado, texto muted quando inativo
- Cards com `border-border/50`, sem sombras excessivas
- Tipografia compacta e profissional

