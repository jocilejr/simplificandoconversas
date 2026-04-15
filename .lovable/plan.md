

## Plano — Deduplicação por CPF no Follow Up

### Problema
A deduplicação atual usa `phoneSendCount` (por telefone) e `max_messages_per_phone_per_day`. Se o mesmo cliente (mesmo CPF) tem 3 boletos pendentes com telefones ligeiramente diferentes, todos passam. Com CPF, a dedup é precisa: 1 cliente = 1 mensagem.

### Mudanças em `deploy/backend/src/routes/followup-daily.ts`

**1. Incluir `customer_document` na query de boletos (linha 297)**
```typescript
.select("id, created_at, customer_name, customer_phone, customer_document, amount, metadata, external_id")
```

**2. Adicionar `customer_document` ao tipo `BoletoRow`**

**3. Deduplicação por CPF em `generateJobsForWorkspace` (após linha 416)**
Antes do loop de boletos, construir um Set de CPFs já processados:
```typescript
const processedCpfs = new Set<string>();
```

Dentro do loop, após encontrar a `matchingRule` e antes de gerar o job:
- Extrair CPF: `const cpf = boleto.customer_document?.replace(/\D/g, "") || null;`
- Se `cpf` existe e `cpf.length >= 11`:
  - Se `processedCpfs.has(cpf)` → marcar como `skipped_duplicate` e `continue`
  - Senão → `processedCpfs.add(cpf)`
- Se não tem CPF → segue o fluxo normal (não bloqueia por falta de CPF)

**4. Adicionar status `skipped_duplicate` ao `FINAL_JOB_STATUSES`**

**5. Adicionar contador `skippedDuplicate` ao `WorkspaceRunResult` e ao response**

**6. Dedup por CPF também no `buildPhoneSendCount` → `buildCpfSendCount`**
Trocar a limitação diária de phone-based para CPF-based:
- Se o boleto tem CPF, contar por CPF
- Fallback para phone se não tem CPF

**7. Frontend — `useFollowUpDispatch.ts` e `FollowUpDashboard.tsx`**
Adicionar `skipped_duplicate` ao tipo de status e exibir no dashboard.

### Resumo
- 1 arquivo backend: `deploy/backend/src/routes/followup-daily.ts`
- 2 arquivos frontend: `useFollowUpDispatch.ts`, `FollowUpDashboard.tsx`
- Dedup primária por CPF, fallback por telefone quando CPF ausente

