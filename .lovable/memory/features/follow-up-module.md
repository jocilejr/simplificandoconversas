---
name: Follow Up Module — 2-Phase Architecture
description: Follow-up billing recovery with separate prepare (00:01) and send (send_at_hour) phases
type: feature
---

## Architecture (v2 — 2 phases)

### Phase 1: PREPARE (cron 00:01 BRT)
- Endpoint: `POST /api/followup-daily/prepare`
- Deletes previous day's jobs from `followup_dispatch_queue`
- Loads pending boletos + active recovery rules per workspace
- Applies rule matching (days_after_generation, days_before_due, days_after_due)
- CPF deduplication: first boleto per CPF = `pending`, rest = `skipped_duplicate`
- Phone validation: invalid/short phones = `skipped_invalid_phone`
- Normalizes phones, snapshots messages/blocks, resolves PDF refs
- Inserts all into `followup_dispatch_queue` — **does NOT send anything**

### Phase 2: SEND (cron at send_at_hour or manual)
- Endpoint: `POST /api/followup-daily/process`
- If manual, runs prepare first to catch new matches
- Selects all `pending` jobs (and `failed` if includeFailed=true)
- For each: claim → send via Evolution API → retry 5x with 20s delay
- `exists:false` from Evolution → immediate skip as `skipped_invalid_phone` (no retry)
- Success → `sent`, exhausted retries → `failed`
- Uses anti-ban message queue per instance

### Single Source of Truth
- `followup_dispatch_queue` is THE source of truth for send status
- Frontend reads dispatch queue via `GET /api/followup-daily/status`
- `boleto_recovery_contacts` is NOT written by automated flow (kept for manual legacy)
- `useBoletoRecovery` hook gets `sendStatus` from `useFollowUpDispatch` dispatch data

### Dashboard Counters
- Pendentes = `pending + processing` only
- Failed is shown separately, NOT counted as pending
- Progress = (sent + failed + all skips) / total jobs

### Crons in index.ts
- `00:01 BRT` → `prepareFollowUpDaily()`
- Every minute → checks `send_at_hour` match → `processFollowUpDaily()`
