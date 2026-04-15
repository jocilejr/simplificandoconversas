

# Plano: Corrigir lógica da Fila de Follow Up

## Problema
A fila (automática e manual) não respeita a regra de deduplicação por CPF no frontend, e o status de "duplicado" não é refletido corretamente na UI porque o backend não registra `skipped_duplicate` em `boleto_recovery_contacts`.

## O que será feito

### 1. Backend: Registrar duplicados em `boleto_recovery_contacts`
**Arquivo:** `deploy/backend/src/routes/followup-daily.ts` (linhas 467-494)

Quando um boleto é marcado como `skipped_duplicate`, adicionar o registro em `boleto_recovery_contacts` com `notes: "skipped_duplicate"` — atualmente só insere na `followup_dispatch_queue` mas não registra o contato, fazendo o frontend não detectar.

### 2. Frontend: Detectar `skipped_duplicate` no `sendStatus`
**Arquivo:** `src/hooks/useBoletoRecovery.ts` (linhas 192-198)

Adicionar condição para detectar `notes.startsWith("skipped_duplicate")` e mapear para `sendStatus = "skipped_duplicate"`. Atualmente só detecta `skipped_phone_limit`, `skipped_invalid_phone` e `failed`.

### 3. Frontend: Filtrar duplicados da fila manual
**Arquivo:** `src/components/followup/FollowUpDashboard.tsx` (linha 387)

A `FollowUpQueue` recebe `pendingTodayBoletos`. Esse filtro (linha 211) já exclui `sent`, mas NÃO exclui `skipped_duplicate`. Com a correção do item 2, duplicados terão `sendStatus = "skipped_duplicate"` e serão automaticamente excluídos da lista de pendentes.

### 4. Frontend: Mostrar "Duplicado" na coluna Envio
**Arquivo:** `src/components/followup/FollowUpDashboard.tsx` (linhas 162-175)

O badge `skipped_duplicate` já é renderizado na coluna Envio como "Duplicado" (linha 170, status `skipped_phone_limit` mostra "Duplicado"). Corrigir para que `skipped_duplicate` tenha seu próprio badge com label "Duplicado (CPF)" distinto do `skipped_phone_limit`.

## Resumo do fluxo correto após correção

1. Backend gera jobs → detecta CPF duplicado → marca `skipped_duplicate` na fila **E** registra em `boleto_recovery_contacts`
2. Frontend lê `boleto_recovery_contacts` → detecta `skipped_duplicate` → marca `sendStatus = "skipped_duplicate"`
3. `pendingTodayBoletos` filtra apenas `pending | processing | failed` → duplicados ficam fora da fila
4. Coluna "Envio" mostra "Duplicado (CPF)" para esses boletos
5. Boletos `sent` já saem da fila (já funciona)

## Arquivos modificados
- `deploy/backend/src/routes/followup-daily.ts` — registrar contato para duplicados
- `src/hooks/useBoletoRecovery.ts` — detectar `skipped_duplicate` no sendStatus
- `src/components/followup/FollowUpDashboard.tsx` — badge distinto para duplicado CPF

