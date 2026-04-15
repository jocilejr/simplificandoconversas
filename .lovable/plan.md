

# Plano: Só bloquear boletos enviados ou duplicados

## Problema
Existem **duas camadas** de bloqueio que impedem boletos pendentes de entrar na fila:

1. **`isBlockingContact`** (linha 227): bloqueia tudo que não é `failed_api` — inclui `skipped_phone_limit`, `skipped_invalid_phone`
2. **`FINAL_JOB_STATUSES`** (linha 10): marca `sent`, `skipped_phone_limit`, `skipped_invalid_phone`, `skipped_duplicate` como status final — boleto com qualquer um desses nunca é reprocessado

## Regra correta (conforme solicitado)
- **Bloqueia**: `sent` e `skipped_duplicate` → boleto já foi tratado
- **NÃO bloqueia**: `skipped_phone_limit`, `skipped_invalid_phone`, `failed_api` → boleto deve poder ser reprocessado

## Correções

### 1. `FINAL_JOB_STATUSES` (linha 10-15)
Remover `skipped_phone_limit` e `skipped_invalid_phone` — só `sent` e `skipped_duplicate` são finais:
```typescript
const FINAL_JOB_STATUSES = new Set(["sent", "skipped_duplicate"]);
```

### 2. `isBlockingContact` (linha 227-228)
Mudar para bloquear **apenas** `sent` e `skipped_duplicate`:
```typescript
function isBlockingContact(notes: string | null | undefined) {
  if (!notes) return false;
  return notes.startsWith("sent") || notes.startsWith("skipped_duplicate");
}
```

### 3. `countsAsSuccessfulContact` (linha 231-232)
Manter como está — já exclui todos os skips e falhas da contagem de limite/dia.

## Resultado
- Boleto `sent` → bloqueado (não reenvia)
- Boleto `skipped_duplicate` → bloqueado (CPF já foi atendido)
- Boleto `skipped_phone_limit` → **reprocessável** na próxima execução
- Boleto `skipped_invalid_phone` → **reprocessável** (caso telefone seja corrigido)
- Boleto `failed_api` → **reprocessável** (já funciona)

## Arquivo modificado
- `deploy/backend/src/routes/followup-daily.ts` — 3 alterações cirúrgicas

## Após deploy
```bash
cd /root/deploy && docker compose up -d --build backend
```

