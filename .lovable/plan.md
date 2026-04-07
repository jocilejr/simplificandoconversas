

## Redesign Follow Up — Layout premium e vivo

### Problema
O layout atual com sidebar separada ficou "morto" — tudo monocromático `text-muted-foreground`, ícones apagados em `bg-primary/10`, sem hierarquia visual. Parece um formulário genérico, não um dashboard de recuperação de vendas.

### Nova abordagem: container único com personalidade

Layout de container único (como TransactionsTable), mas com uso intencional da cor primária dourada (#c5a55a) nos números importantes, progresso visual mais presente, e melhor hierarquia de informação.

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Follow Up                          [⟳] [⚙ Régua] [▶ Recuperar]   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ R$4.500 │  │   12    │  │  5/12   │  │    7    │  │   3     │ │
│  │ em jogo │  │ total   │  │ enviado │  │ pend.   │  │ vencido │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │
│                                                                     │
│  [████████████████████░░░░░] 67% do dia                            │
├─────────────────────────────────────────────────────────────────────┤
│  [Hoje(8)] [Pendentes(12)] [Vencidos(3)] [Todos(23)]               │
│  🔍 Buscar...                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Cliente      │ Telefone │ Valor  │ Vence  │ Status  │ Ações       │
│  João Silva   │ 119...   │ R$150  │ 04/04  │ ●Pend.  │ ☎ 📋 📄   │
│  Maria Costa  │ 219...   │ R$200  │ 05/04  │ ●Venc.  │ ☎ 📋 📄   │
└─────────────────────────────────────────────────────────────────────┘
```

### Mudanças no `FollowUpDashboard.tsx` — reescrita completa

**Container único** `bg-card border border-border/30 rounded-xl p-4 sm:p-6` — sem sidebar separada.

**Header inline:**
- Título "Follow Up" + botão RefreshCw (ghost) à esquerda
- Botões "Configurar Régua" (outline) e "Iniciar Recuperação" (default/primary) à direita
- Tudo na mesma linha, compacto

**Stats bar — 5 colunas com vida:**
- Grid `grid-cols-2 sm:grid-cols-5 gap-3` dentro de um `p-4 bg-secondary/20 rounded-lg border border-border/30`
- Cada stat: número grande `text-lg font-bold` + label pequeno `text-xs text-muted-foreground`
- **Valor total**: número em `text-primary` (dourado) — destaque principal
- **Enviados**: mostrar fração "5/12" com a parte enviada em `text-primary`
- **Vencidos**: número em `text-destructive` quando > 0
- Ícones pequenos (`h-4 w-4`) dentro de containers `p-2 rounded-lg` com cores sutis mas visíveis: `bg-primary/10 text-primary`, `bg-green-500/10 text-green-500`, `bg-destructive/10 text-destructive`

**Barra de progresso visível:**
- Abaixo dos stats, `h-2 rounded-full` (mais grossa que a atual `h-1.5`)
- Label à direita: "67% do dia" em `text-xs font-medium`
- Cor da barra: `bg-primary` (dourado) — não cinza genérico

**Tabs + Search** — mesmo padrão do TransactionsTable (grid-cols-4, contadores entre parênteses)

**Tabela** — exatamente o padrão TransactionsTable:
- `overflow-hidden rounded-lg border border-border/30`
- `thead bg-secondary/30`, headers `uppercase tracking-wider`
- Colunas: Cliente, Telefone, Valor, Vencimento, Status, Ações
- Badges de status com ícone dot: `●` antes do texto para dar vida
- Ações inline: `variant="ghost"` icon buttons com hover visível
- Linhas `hover:bg-secondary/40 cursor-pointer transition-colors`

**Mobile:** stats viram `grid-cols-2`, tabela vira cards compactos

**Detail dialog** — mantém como está (já funcional)

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/followup/FollowUpDashboard.tsx` | Reescrita: container único, stats bar com cor dourada, progresso visível, tabela profissional |
| `src/pages/FollowUp.tsx` | Manter como está (wrapper mínimo) |

Lógica intacta: `FollowUpQueue`, `FollowUpRulesConfig`, `useBoletoRecovery` sem alteração.

