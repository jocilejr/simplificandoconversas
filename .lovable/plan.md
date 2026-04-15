
Diagnóstico: não é “só no front”, e também não é “todas as transações entram normalizadas”.

O que encontrei no código:

1. Na interface, vários pontos normalizam apenas para exibição:
- `src/components/transactions/TransactionDetailDialog.tsx`
- `src/components/transactions/RecoveryPopover.tsx`
- `src/components/transactions/BoletoQuickRecovery.tsx`
Todos usam `src/lib/normalizePhone.ts` ao mostrar o telefone.

2. No backend, há rotas que salvam `transactions.customer_phone` já normalizado:
- `deploy/backend/src/routes/payment.ts`
- `deploy/backend/src/routes/manual-payment-webhook.ts`
- `deploy/backend/src/routes/member-purchase.ts`
- `deploy/backend/src/routes/yampi-webhook.ts`

3. Mas há rotas que salvam telefone cru/inconsistente:
- `deploy/backend/src/routes/platform-api.ts`
  - em `/transactions` salva só `replace(/\D/g, "")`
  - em `generate-payment` salva `customer_phone || null` sem normalizar
- `deploy/backend/src/routes/external-webhook.ts`
  - cria transação com `cleanedPhone`, que pode não seguir o padrão final usado pela recuperação

4. O Follow Up hoje está lendo o valor bruto de `transactions`:
- `deploy/backend/src/routes/followup-daily.ts`
- hoje ele faz `const normalized = boleto.customer_phone || null`
- por isso a fila herda exatamente o valor salvo no banco, certo ou errado

Conclusão
A recuperação automática “funciona” quando a transação veio de uma rota que normaliza na escrita.
Ela quebra quando a transação veio de uma rota que grava cru.
A tela mascara isso porque formata na leitura.

Plano de correção

1. Padronizar a origem da verdade no backend
- Criar/usar uma única função de normalização no backend (`deploy/backend/src/lib/normalize-phone.ts`) para toda gravação de `transactions.customer_phone`.

2. Corrigir todas as rotas que ainda gravam bruto
- Ajustar `deploy/backend/src/routes/platform-api.ts`
- Ajustar `deploy/backend/src/routes/external-webhook.ts`
- Revisar qualquer insert/update restante em `transactions.customer_phone` para garantir padrão único `55...`.

3. Blindar o Follow Up
- Em `deploy/backend/src/routes/followup-daily.ts`, normalizar antes de gravar `phone` e `normalized_phone` na fila.
- No processamento da fila, normalizar novamente como defesa para jobs antigos.

4. Parar de depender do “telefone exibido”
- O Follow Up deve sempre trabalhar com o telefone normalizado do backend, nunca com o valor “como veio” nem com aparência da UI.

5. Limpeza de dados já gerados
- Após corrigir o código, limpar os jobs do dia na `followup_dispatch_queue` para regenerar com os números corretos.
- Se quiser consistência histórica, fazer um script/migração para corrigir `transactions.customer_phone` legado.

Validação na VPS
Vou te orientar a validar exatamente dentro da VPS, comparando:
- transações criadas por cada rota/origem
- telefone salvo em `transactions`
- telefone gravado em `followup_dispatch_queue`

Arquivos que precisam ser ajustados
- `deploy/backend/src/routes/followup-daily.ts`
- `deploy/backend/src/routes/platform-api.ts`
- `deploy/backend/src/routes/external-webhook.ts`

Observação importante
Existe um indício adicional de inconsistência no próprio `followup-daily.ts`: ele referencia `normalizePhoneDefensive(...)` no carregamento de contatos do dia, mas essa função não aparece definida no arquivo lido. Na implementação eu também revisaria isso para remover qualquer lógica “paralela” de normalização e centralizar tudo em uma única função backend.
