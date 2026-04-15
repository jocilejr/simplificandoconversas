

# Plano: Contadores de entrada/saída por grupo + totais no dashboard

## O que muda

### 1. Grid de estatísticas — 2 novos StatCards totais
Expandir de 4 para 6 cards (`lg:grid-cols-6`), adicionando:
- **Entraram** (UserPlus, verde) — total de eventos `action === "add"`
- **Saíram** (UserMinus, vermelho) — total de eventos `action === "remove"`

### 2. Card "Grupos Monitorados" — contadores por grupo
Cada linha de grupo passa a mostrar, além do badge de membros, dois mini-contadores:
- `+N` em verde (entradas naquele grupo)
- `-N` em vermelho (saídas naquele grupo)

Derivado cruzando `events` com `selectedGroups` via `group_jid`:

```typescript
const eventsByGroup = events.reduce((acc, e) => {
  const jid = e.group_jid;
  if (!acc[jid]) acc[jid] = { add: 0, remove: 0 };
  if (e.action === "add") acc[jid].add++;
  if (e.action === "remove") acc[jid].remove++;
  return acc;
}, {});
```

Na listagem, cada grupo mostra:
```
Nome do Grupo          +3  -1  [125]
Instância
```

## Arquivo modificado
- `src/components/grupos/GroupDashboardTab.tsx` — novos StatCards + contadores inline por grupo

Sem alterações no backend. Os dados já vêm do `useGroupEvents` (últimos 50 eventos).

