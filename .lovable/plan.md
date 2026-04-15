

## Plano — Corrigir Follow Up: usar telefone direto + ordem de deduplicação

### Problemas identificados

1. **Telefone não normalizado**: Linhas 444 e 492 fazem `.replace(/\D/g, "")` no `customer_phone` — isso remove formatação mas NÃO adiciona "55". O `customer_phone` já vem normalizado da `transactions` (com 55 prefix), então basta usar direto sem transformação.

2. **Deduplicação CPF antes de validações**: A checagem de CPF (linha 440) roda ANTES de `blockedRuleKeys` (linha 478). Resultado: boleto A (CPF X) já foi contactado → CPF X entra no Set → boleto A é pulado por `blockedRuleKeys` → boleto B (mesmo CPF, legítimo) é marcado como duplicado sem nenhum ter sido enviado.

3. **Ordem de boletos indeterminada**: Sem ORDER BY na query (linha 299-304), a ordem muda entre execuções.

### Correções em `deploy/backend/src/routes/followup-daily.ts`

**1. Query com ORDER BY (linha 304)**
Adicionar `.order("created_at", { ascending: true })` para processar boletos do mais antigo ao mais recente.

**2. Usar `customer_phone` direto como `normalized_phone`**
Nas linhas 444 e 492, trocar:
```typescript
const normalized = boleto.customer_phone?.replace(/\D/g, "") || null;
```
Por:
```typescript
const normalized = boleto.customer_phone || null;
```
O telefone já está normalizado na inserção da transação. Mesma mudança na linha 778 do processamento.

**3. Reordenar: validações ANTES da deduplicação CPF**
Mover `blockedRuleKeys`, `existingJob` e `blocks.length === 0` para ANTES da checagem de CPF. Só adicionar o CPF ao Set se o boleto realmente vai gerar um job pendente:

```typescript
for (const boleto of context.boletos) {
  // 1. Encontrar regra
  const matchingRule = findMatchingRule(...);
  if (!matchingRule) { skip; continue; }

  const ruleKey = makeRuleKey(boleto.id, matchingRule.id);

  // 2. Já contactado hoje?
  if (blockedRuleKeys.has(ruleKey)) { skip; continue; }

  // 3. Job já existe com status final?
  const existingJob = existingJobsByKey.get(ruleKey);
  if (existingJob && FINAL_JOB_STATUSES.has(existingJob.status)) { skip; continue; }

  // 4. Tem blocos?
  const blocks = buildBlocks(matchingRule);
  if (blocks.length === 0) { skip; continue; }

  // 5. AGORA sim: deduplicação por CPF
  const cpf = boleto.customer_document?.replace(/\D/g, "") || null;
  if (cpf && cpf.length >= 11) {
    if (processedCpfs.has(cpf)) { upsert skipped_duplicate; continue; }
    processedCpfs.add(cpf);
  }

  // 6. Gerar job pendente
  const normalized = boleto.customer_phone || null;
  // ... upsert pending job
}
```

### Resumo
- 1 arquivo: `deploy/backend/src/routes/followup-daily.ts`
- Usar `customer_phone` direto (sem re-processar)
- Mover dedup CPF para DEPOIS das validações de regra/contato/blocos
- Adicionar ORDER BY na query de boletos

### Validação VPS
```bash
docker compose exec -T postgres psql -U postgres -d postgres -c \
  "SELECT customer_phone, length(customer_phone) FROM transactions WHERE type='boleto' AND status='pendente' ORDER BY created_at DESC LIMIT 10;"
```

