

## Fix: Colunas inexistentes no insert de pagamento manual

### Problema
O insert na tabela `transactions` inclui duas colunas que **não existem** no schema:
- `normalized_phone` — não existe na tabela transactions
- `webhook_source` — não existe na tabela transactions

### Solução
Remover as duas colunas do insert em `src/components/leads/LeadDetailDialog.tsx` (linha 243 e 247).

### Arquivo alterado
- `src/components/leads/LeadDetailDialog.tsx` — remover `normalized_phone` e `webhook_source` do objeto de insert

