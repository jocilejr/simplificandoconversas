
# Plano: limpar notificação automaticamente ao entrar em cada subaba de Transações

## Diagnóstico do que encontrei
Hoje já existe tentativa de limpeza automática, mas o fluxo está frágil:

- `TransactionsTable.tsx`
  - chama `markTabSeen(...)` no `onClick` de cada `TabsTrigger`
  - também chama `markTabSeen(activeTab)` num `useEffect` ao trocar de aba
  - ainda chama `markAllSeen()` no carregamento inicial
- `useUnseenTransactions.ts`
  - conta qualquer transação com `viewed_at IS NULL`
- `platform-api.ts`
  - `/mark-tab-seen` marca por categoria
  - `/mark-all-seen` marca tudo do workspace

Ou seja: a intenção existe, mas a limpeza depende de chamadas redundantes e não há validação forte se a aba realmente ficou “vista” no momento certo. Como você usa só a VPS, vou tratar isso como fluxo da VPS e validar com logs da VPS.

## Ajuste que vou fazer

### 1. Tornar a limpeza por subaba determinística
**Arquivo:** `src/components/transactions/TransactionsTable.tsx`

Vou simplificar a regra:

- remover duplicidade de disparo no `onClick` dos `TabsTrigger`
- deixar a limpeza acontecer por estado real da aba ativa
- quando `activeTab` mudar para:
  - `aprovados`
  - `boletos-gerados`
  - `pix-cartao-pendentes`
  - `rejeitados`
  
  chamar `markTabSeen(activeTab)` automaticamente

Assim a limpeza passa a depender da aba aberta, e não do clique em si.

### 2. Remover o comportamento agressivo de “limpar tudo”
**Arquivo:** `src/components/transactions/TransactionsTable.tsx`

Vou remover ou restringir o `markAllSeen()` no carregamento inicial.

Motivo:
- isso mascara bugs
- mistura categorias
- não segue a regra que você definiu: cada subaba limpa sua própria notificação

O comportamento correto vai ficar:
- abriu **Aprovados** → limpa unseen de aprovados
- abriu **Boletos** → limpa unseen de boletos
- abriu **PIX/Cartão pendentes** → limpa unseen dessa categoria
- abriu **Rejeitados** → limpa unseen dessa categoria

### 3. Melhorar o backend para responder com mais clareza
**Arquivo:** `deploy/backend/src/routes/platform-api.ts`

Vou manter `/mark-tab-seen`, mas deixar o retorno mais útil para debug:

- `updated`
- `tab`
- possivelmente `workspaceId`
- log claro por categoria

Exemplo de log esperado:
```text
[mark-tab-seen] workspace=... tab=aprovados updated=3
```

Isso facilita confirmar na VPS que a limpeza realmente rodou.

### 4. Ajustar a leitura do badge para refletir imediatamente
**Arquivo:** `src/hooks/useUnseenTransactions.ts`

Depois do `markTabSeen`, vou manter a invalidação das queries, mas também posso fazer update otimista local dos counts da aba atual para o badge sumir instantaneamente sem esperar polling.

Resultado esperado:
- o pontinho some na hora
- o título da aba do navegador também atualiza sem atraso perceptível

## Como vou validar na VPS
Depois da implementação, vou te deixar estes testes para rodar na VPS:

```bash
docker logs deploy-backend-1 --since=5m 2>&1 | grep -i "mark-tab-seen\|mark-all-seen\|unseen" | tail -80
```

E para testar abrindo as subabas:
1. abrir `/transacoes`
2. entrar em `Aprovados`
3. conferir log de `mark-tab-seen`
4. entrar em `Boletos`
5. conferir log de `mark-tab-seen`
6. entrar em `PIX/Cartão`
7. conferir log de `mark-tab-seen`
8. entrar em `Rejeitados`
9. conferir se o badge da sidebar e o `document.title` zeram corretamente

## Resultado esperado
Depois desse ajuste:

- a notificação não ficará “presa”
- cada subaba limpará automaticamente sua própria categoria ao ser aberta
- o badge lateral refletirá exatamente o que ainda não foi visualizado
- não dependeremos mais de `markAllSeen()` para esconder problema

## Detalhe técnico importante
O bug não parece ser “transação antiga órfã” apenas. O problema principal é de fluxo de visualização: a UI precisa tratar a abertura da subaba como evento oficial de leitura e sincronizar isso de forma previsível com o backend da VPS.
