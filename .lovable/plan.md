

# Leads: Trocar grid de cards por lista compacta

## Resumo
Substituir o grid de cards (3 colunas) por uma lista vertical com linhas clicáveis, mais densa e eficiente para escanear muitos leads.

## Layout proposto

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Nome              Telefone           Email        Pedidos  Total    Agend.  Status │
├──────────────────────────────────────────────────────────────────────┤
│ João Silva        +55 (11) 99999...  joao@...     3        R$500   2       ✅ Pagou │
│ Maria Santos      +55 (14) 99888...  —            0        —       0       ❌       │
│ Carlos Lima       +55 (11) 98777...  carlos@...   1        R$120   1       ✅ Pagou │
└──────────────────────────────────────────────────────────────────────┘
```

## Alteração

### `src/pages/Leads.tsx`
- Substituir o `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">` por uma tabela/lista usando os componentes `Table`, `TableHeader`, `TableRow`, `TableCell` do shadcn
- Colunas: Nome, Telefone, Email, Pedidos Pagos, Total Pago, Agendamentos, Status, Tags
- Cada `TableRow` clicável com `onClick={() => setSelectedLead(l)}` e `cursor-pointer`
- Em mobile, esconder colunas menos importantes (email, agendamentos) com `hidden md:table-cell`
- Manter header, busca, filtros, tabs e paginação exatamente como estão
- Manter os dialogs (novo lead, CSV, detalhe) sem alteração

