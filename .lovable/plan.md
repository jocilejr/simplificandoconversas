

## Refinamento visual do Follow Up — estilo profissional alinhado com Transações

### Problema
O layout atual tem cores chamativas (botão verde neon, ícones coloridos em backgrounds circulares, badges com cores fortes) que destoam do padrão profissional e sóbrio usado na página de Transações. A sidebar usa `bg-secondary/20` com ícones coloridos que parecem amadores.

### Referência de estilo (TransactionsTable)
A página de Transações usa:
- Container: `bg-card border border-border/30 rounded-xl p-4 sm:p-6`
- Stats bar: `bg-secondary/20 rounded-lg border border-border/30` com ícones em `bg-primary/10`, `bg-green-500/10` etc (sutil, não chamativo)
- Tabela: `overflow-hidden rounded-lg border border-border/30` com `thead bg-secondary/30`, headers `uppercase tracking-wider text-xs font-semibold`
- Badges: `variant="outline"` com classes suaves como `bg-green-500/20 text-green-600 border-green-500/30`
- Botões: `variant="ghost"` ou `variant="outline"`, nunca verde sólido

### Mudanças no `FollowUpDashboard.tsx`

**Sidebar:**
- Remover backgrounds coloridos dos ícones (`bg-primary/10`, `bg-amber-500/10`, `bg-emerald-500/10`, `bg-destructive/10`)
- Usar ícones monocromáticos `text-muted-foreground` sem background circular, igual ao padrão da TransactionsTable stats bar
- Stats: usar `p-2 rounded-lg bg-primary/10` para o ícone (mesmo padrão da stats bar de Transações)
- Botão "Iniciar Recuperação": trocar de `className` padrão (verde) para `variant="default"` sem cor customizada — usa a `primary` do tema
- Botão "Configurar Régua": manter `variant="outline"` (já está ok)
- Remover `bg-secondary/20` individual de cada stat, usar separadores `divide-y divide-border/30` entre stats

**Tabela (painel principal):**
- Envolver tabela em `overflow-hidden rounded-lg border border-border/30` (igual Transações)
- Header da tabela: `bg-secondary/30` com `text-xs font-semibold text-muted-foreground uppercase tracking-wider`
- Padding das cells: `py-3 px-4` (igual Transações, atualmente usa `py-2.5 px-3`)
- Badges de status: usar exatamente o mesmo padrão `variant="outline"` com classes de cor suaves:
  - Enviado: `bg-green-500/20 text-green-600 border-green-500/30`
  - Vencido: `bg-destructive/20 text-destructive border-destructive/30`
  - Pendente: `bg-yellow-500/20 text-yellow-600 border-yellow-500/30`
  - Com regra: `bg-blue-500/20 text-blue-600 border-blue-500/30`

**Tabs:**
- Manter grid-cols-4 mas sem ícones dentro das tabs (remover `Clock`, `CalendarClock`, `AlertTriangle`, `TrendingUp` das tabs — mais limpo)

**Header:**
- Adicionar botão RefreshCw ghost igual ao de Transações

### Arquivo modificado

| Arquivo | Ação |
|---------|------|
| `src/components/followup/FollowUpDashboard.tsx` | Refinamento visual: cores, badges, tabela, sidebar — alinhado com TransactionsTable |

Nenhum arquivo criado ou deletado. Apenas ajustes de classes CSS e pequenas mudanças de markup para alinhar com o padrão profissional existente.

