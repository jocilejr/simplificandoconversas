

# Plano: Reescrever a lógica do Follow Up — 2 fases claras

## Problema atual

O sistema mistura geração de jobs, filtragem, deduplicação CPF e envio em um único fluxo monolítico (`processWorkspace`). O frontend depende de duas tabelas (`boleto_recovery_contacts` + `followup_dispatch_queue`) que frequentemente discordam, causando contadores incorretos ("Pendentes" falsos). Retries desnecessários em números inexistentes. O cron verifica o horário por workspace mas não existe uma "preparação" separada à meia-noite.

## Nova arquitetura: 2 processos independentes

```text
┌─────────────────────────────────────────┐
│  FASE 1 — PREPARAÇÃO (cron 00:01 BRT)   │
│                                          │
│  1. Limpa a tabela do dia anterior       │
│  2. Carrega todas as transactions        │
│     pendentes tipo boleto                │
│  3. Aplica as réguas ativas              │
│  4. Para cada match:                     │
│     - Normaliza telefone                 │
│     - Resolve ref do PDF                 │
│     - Snapshot da mensagem/blocos        │
│     - Insere na followup_dispatch_queue  │
│       com status = "pending"             │
│  5. Deduplicação CPF: se CPF aparece     │
│     em >1 boleto, deixa 1 "pending"      │
│     e marca os demais "skipped_duplicate" │
│  6. Telefone inválido: marca             │
│     "skipped_invalid_phone" direto       │
│                                          │
│  Resultado: tabela 100% preparada        │
│  com tudo pré-calculado pro dia          │
└─────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│  FASE 2 — ENVIO (cron no send_at_hour)  │
│                                          │
│  1. SELECT * FROM followup_dispatch_queue│
│     WHERE status = 'pending'             │
│     AND dispatch_date = TODAY            │
│  2. Para cada job sequencialmente:       │
│     - Verifica se transação ainda é      │
│       "pendente" (não foi paga)          │
│     - Envia via Evolution API            │
│     - Se erro: retry 5x com 20s delay   │
│     - Se exists:false → skip imediato    │
│     - Se sucesso: marca "sent"           │
│     - Se falha final: marca "failed"     │
│  3. Sem boleto_recovery_contacts         │
│     O frontend lê DIRETO da             │
│     followup_dispatch_queue              │
└─────────────────────────────────────────┘
```

## Mudanças concretas

### Backend: `deploy/backend/src/routes/followup-daily.ts` (reescrita ~80%)

**Novo endpoint `POST /api/followup-daily/prepare`** — chamado pelo cron às 00:01
- Deleta jobs do dia anterior (ou dias passados) da `followup_dispatch_queue`
- Carrega boletos pendentes + réguas ativas por workspace
- Aplica matching de réguas
- Faz deduplicação CPF (1 pendente por CPF, resto `skipped_duplicate`)
- Valida telefone (inválido → `skipped_invalid_phone`)
- Insere todos na `followup_dispatch_queue` com dados pré-calculados
- Não envia nada

**Endpoint `POST /api/followup-daily/process` simplificado** — chamado pelo cron no `send_at_hour` ou manualmente
- Seleciona todos os `pending` da `followup_dispatch_queue` do dia
- Para cada um: claim → envio → retry 5x/20s → mark sent/failed
- Detecta `exists:false` → marca `skipped_invalid_phone` sem retry
- **Remove** toda interação com `boleto_recovery_contacts`

**Endpoint `GET /api/followup-daily/status`** — sem mudanças na interface, mas simplificado internamente

### Backend: `deploy/backend/src/index.ts` — ajuste no cron

- Adicionar cron `1 0 * * *` (00:01 BRT) chamando `/api/followup-daily/prepare`
- Manter cron minuto-a-minuto para `send_at_hour` chamando `/api/followup-daily/process`

### Frontend: `src/hooks/useBoletoRecovery.ts` — simplificar

- **Remover** queries a `boleto_recovery_contacts`
- O `sendStatus` de cada boleto vem direto do `dispatchStatus` (já carregado via `useFollowUpDispatch`)
- Cruzar `transaction_id + rule_id` do dispatch queue com os boletos
- Um único ponto de verdade: a `followup_dispatch_queue`

### Frontend: `src/components/followup/FollowUpDashboard.tsx` — ajustar contadores

- `effectivePending` = apenas `counts.pending + counts.processing`
- `effectiveSent` = `counts.sent`
- Falhas e skips em contadores separados
- Remover referência a `pendingTodayBoletos` baseado em lógica do hook antigo

### Frontend: `src/hooks/useFollowUpDispatch.ts` — sem mudanças estruturais

O hook já consulta `/api/followup-daily/status` que retorna os dados da queue.

## Tabela `followup_dispatch_queue` — sem mudanças de schema

A tabela já existe com todos os campos necessários. Apenas muda o ciclo de vida:
- Preparação (00:01) popula com `pending` / `skipped_*`
- Envio (send_at_hour) processa os `pending`

## Benefícios

1. **Um único ponto de verdade** — só a `followup_dispatch_queue` importa
2. **Elimina `boleto_recovery_contacts`** do fluxo automático (pode manter para uso manual/legado)
3. **Sem contadores falsos** — o que está na tabela É o status real
4. **Preparação e envio desacoplados** — debug muito mais fácil
5. **Retry inteligente** — 5x com 20s, skip imediato para `exists:false`

## Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `deploy/backend/src/routes/followup-daily.ts` | Reescrita: separar prepare/process |
| `deploy/backend/src/index.ts` | Adicionar cron 00:01 para prepare |
| `src/hooks/useBoletoRecovery.ts` | Simplificar: status vem da dispatch queue |
| `src/components/followup/FollowUpDashboard.tsx` | Corrigir contadores |
| `src/hooks/useFollowUpDispatch.ts` | Ajuste menor se necessário |

## Deploy

```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

