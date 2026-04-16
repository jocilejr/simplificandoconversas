

# Plano: Eliminar "Pendentes fantasma" — frontend deve confiar 100% na dispatch queue

## Causa raiz

O frontend faz rule-matching LOCAL (recalcula quais boletos deveriam receber cobrança hoje) e cruza com o `dispatchMap` por `transaction_id`. Quando um boleto:
1. Tem regra match no frontend mas **não existe** na dispatch queue → aparece como "Pendente"
2. Existe na queue com regra diferente da calculada localmente → não encontra no map → "Pendente"

O backend (prepare) é quem faz o matching real. O frontend NÃO deveria refazer esse cálculo.

## Solução

### Princípio: O frontend deve mostrar EXATAMENTE o que a dispatch queue diz

A aba "Hoje" deve listar APENAS os boletos que existem na `followup_dispatch_queue` do dia, não todos os boletos que "poderiam" ter regra. A queue é a fonte de verdade.

### 1. `src/hooks/useBoletoRecovery.ts` — parar de recalcular regras para "Hoje"

- `todayBoletos`: em vez de filtrar por `applicableRule !== null`, filtrar por **presença no `dispatchMap`**
- O `sendStatus` de boletos SEM entrada no dispatchMap deve ser `null`/`undefined`, NÃO `"pending"`
- `pendingTodayBoletos`: boletos que estão no dispatch com status `pending` ou `processing`
- `applicableRule` pode continuar sendo calculado para exibição, mas não para filtro de "Hoje"
- Adicionar o status da queue como campo derivado (não default "pending")

Mudanças:
```typescript
// Default: sem status (não está na queue de hoje)
let sendStatus: BoletoWithRecovery["sendStatus"] | null = null;
if (dispatchInfo) {
  sendStatus = dispatchInfo.status as BoletoWithRecovery["sendStatus"];
}

// todayBoletos: APENAS os que existem na dispatch queue
const todayBoletos = processedBoletos.filter(b => dispatchMap.has(b.id));
const pendingTodayBoletos = todayBoletos.filter(b => b.sendStatus === "pending" || b.sendStatus === "processing");
```

### 2. `src/hooks/useBoletoRecovery.ts` — tipo `BoletoWithRecovery`

- Mudar `sendStatus` para aceitar `null` (sem entry na queue)
- Ajustar interface e badge no dashboard

### 3. `src/components/followup/FollowUpDashboard.tsx` — badge "Pendente"

- `sendStatus === null` → sem badge (ou "Sem regra hoje")
- `sendStatus === "pending"` → badge amarelo "Pendente"
- Nenhuma mudança nos contadores (já usam `queueCounts`)

### 4. Backend: `/api/followup-daily/status` — incluir mais dados

- Aumentar limit de 200 para cobrir todos os jobs do dia (ou usar count separado)
- O limit de 200 pode estar cortando jobs — se tem 37 hoje está ok, mas para segurança

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useBoletoRecovery.ts` | `sendStatus` default `null`, `todayBoletos` filtrado pelo dispatchMap |
| `src/components/followup/FollowUpDashboard.tsx` | Badge para `sendStatus === null` |

## Resultado esperado

- "Hoje (37)" em vez de "Hoje (39)" — mostra só o que está na queue
- "Pendentes: 0" — correto, não há pendentes reais
- Nenhum boleto fantasma aparece como "Pendente"
- O botão "Executar" só tenta processar o que realmente está na queue

