

## Redesign Follow Up — Layout sidebar + content

### Conceito
Em vez do layout vertical atual (hero card -> tabs -> lista de cards), o novo layout usa um design **split-panel horizontal**: uma sidebar esquerda fixa com stats e filtros, e um painel de conteudo principal a direita com a tabela de boletos.

### Estrutura visual

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Follow Up                                                          │
├────────────────────┬─────────────────────────────────────────────────┤
│                    │                                                 │
│  PAINEL LATERAL    │  PAINEL PRINCIPAL                               │
│  (w-72, fixo)      │                                                 │
│                    │  [Hoje] [Pendentes] [Vencidos] [Todos]          │
│  ┌──────────────┐  │  ┌─ search ──────────────────────────────┐     │
│  │ Valor Total  │  │  └───────────────────────────────────────┘     │
│  │ R$ 4.500     │  │                                                 │
│  └──────────────┘  │  ┌─────────────────────────────────────────┐   │
│  ┌──────────────┐  │  │ Cliente   │ Valor │ Vence  │ Regra │ ⋮ │   │
│  │ Pendentes    │  │  │ Joao      │ R$150 │ 04/04  │ D+1   │ ⋮ │   │
│  │ 12           │  │  │ Maria     │ R$200 │ 05/04  │ D-1   │ ⋮ │   │
│  └──────────────┘  │  │ ...       │       │        │       │   │   │
│  ┌──────────────┐  │  └─────────────────────────────────────────┘   │
│  │ Enviados     │  │                                                 │
│  │ 5 / 12       │  │  [Mostrar mais]                                │
│  └──────────────┘  │                                                 │
│  ┌──────────────┐  │                                                 │
│  │ Vencidos     │  │                                                 │
│  │ 3            │  │                                                 │
│  └──────────────┘  │                                                 │
│                    │                                                 │
│  ──── Progresso ── │                                                 │
│  [████████░░] 67%  │                                                 │
│                    │                                                 │
│  [▶ Recuperar]     │                                                 │
│  [⚙ Regua]         │                                                 │
│                    │                                                 │
└────────────────────┴─────────────────────────────────────────────────┘
```

Em mobile (< sm), o sidebar vira uma barra horizontal compacta colapsavel no topo.

### Mudancas

#### 1. `FollowUpDashboard.tsx` — reescrita completa
- Layout `flex gap-6` com sidebar esquerda (`w-72 shrink-0`) e conteudo flex-1
- **Sidebar**: fundo `bg-card border rounded-xl p-5`
  - Stats empilhados verticalmente: Valor Total, Pendentes, Enviados/Total, Vencidos — cada um com icone + numero grande
  - Progress bar circular ou linear do dia
  - Botoes "Iniciar Recuperacao" e "Configurar Regua" empilhados no final
- **Conteudo principal**: `bg-card border rounded-xl p-5`
  - Tabs horizontais compactas (mesma estetica de TransactionsTable: `grid-cols-4 text-xs`)
  - Search input
  - **Tabela HTML real** com `<table>` (nao cards empilhados):
    - Colunas: Cliente, Telefone, Valor, Vencimento, Status/Regra, Acoes
    - Linhas com `hover:bg-secondary/40 cursor-pointer`
    - Badges coloridos para status (Pendente=amarelo, Vencido=vermelho, Enviado=verde)
    - Acoes inline: icones WhatsApp, Copy, FileText
  - "Mostrar mais" no final
- **Mobile**: sidebar se torna `grid grid-cols-4 gap-2` horizontal com stats compactos, sem separacao lateral

#### 2. `FollowUpHeroCard.tsx` — deletar
Funcionalidade absorvida pela sidebar do dashboard.

#### 3. `FollowUp.tsx` — simplificar
Remover h1/p; titulo fica dentro do dashboard.

#### 4. Intactos
- `FollowUpQueue.tsx` — modal tinder mantido
- `FollowUpRulesConfig.tsx` — dialog de regras mantido
- `useBoletoRecovery.ts` — hook sem alteracao

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/followup/FollowUpDashboard.tsx` | Reescrita completa (sidebar + tabela) |
| `src/components/followup/FollowUpHeroCard.tsx` | Deletar |
| `src/pages/FollowUp.tsx` | Simplificar para wrapper minimo |

