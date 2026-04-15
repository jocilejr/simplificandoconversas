

## Plano — Follow Up usar telefone normalizado direto da transação

### Diagnóstico
A tabela `transactions` já armazena o telefone normalizado via `normalizePhone()` no momento da inserção (linhas 266, 328 de `payment.ts`). O Follow Up não precisa aplicar normalização própria — basta usar `customer_phone` diretamente.

Atualmente há **3 pontos** onde o Follow Up aplica normalização desnecessária:

1. **Linha 470** — `generateJobsForWorkspace`: `normalizePhone(boleto.customer_phone)` + cross-reference com conversations
2. **Linha 763** — `processQueueForWorkspace`: `normalizePhone(job.phone || job.normalized_phone)` — re-normaliza antes do envio

### Correção em `deploy/backend/src/routes/followup-daily.ts`

**Ponto 1 (linha 469-477)** — Substituir toda a lógica de normalização + cross-reference por uso direto:
```typescript
// DE:
let normalized = normalizePhone(boleto.customer_phone);
if (normalized && normalized.length >= 8) {
  const last8 = normalized.slice(-8);
  const convPhone = context.convPhoneByLast8.get(last8);
  if (convPhone) normalized = convPhone;
}

// PARA:
const normalized = boleto.customer_phone?.replace(/\D/g, "") || null;
```
Apenas strip de caracteres não-numéricos, sem adicionar prefixos. O valor já vem normalizado do banco.

**Ponto 2 (linha 763)** — Remover re-normalização no processamento:
```typescript
// DE:
const normalizedPhone = normalizePhone(job.phone || job.normalized_phone);

// PARA:
const normalizedPhone = (job.normalized_phone || job.phone || "").replace(/\D/g, "") || null;
```

**Ponto 3** — Remover o `import { normalizePhone }` e a construção do `convPhoneByLast8` no contexto (já que não será mais usado para cross-reference).

Também limpar o `convPhoneByLast8` do `WorkspaceContext` e a query de conversations que alimentava esse mapa.

### Resumo
- 1 arquivo: `deploy/backend/src/routes/followup-daily.ts`
- Remoção de `normalizePhone` e `convPhoneByLast8`
- Uso direto do `customer_phone` da transação (já normalizado na inserção)

### Validação VPS
```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "SELECT customer_phone, length(customer_phone) FROM transactions WHERE type='boleto' AND status='pendente' LIMIT 20;"
```

