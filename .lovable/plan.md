

## Plano: Criar rota VPS `member-purchase` e corrigir todas as transações

### Problema
A edge function `member-purchase` tenta inserir em `transactions` sem `user_id` e `workspace_id` (ambos NOT NULL), então o insert falha silenciosamente. Além disso, o fluxo de boleto não cria transação nenhuma — apenas chama um webhook externo.

### Solução

**1. Nova rota VPS: `deploy/backend/src/routes/member-purchase.ts`**

Recebe: `{ phone, offer_name, payment_method, amount, workspace_id, customer_name?, customer_document? }`

Lógica:
- Resolver `user_id` via `workspaces.created_by` usando o `workspace_id` recebido
- Inserir em `transactions` com todos os campos obrigatórios (`user_id`, `workspace_id`, `type`, `status: "pendente"`, `amount`, `customer_phone`, `description`, `source: "member-area"`)
- Se `customer_name`/`customer_document` forem fornecidos, incluir na transação
- Retornar `{ success: true, transaction_id }`

**2. Registrar rota em `deploy/backend/src/index.ts`**

Adicionar `app.use("/api/member-purchase", memberPurchaseRouter)`

**3. Alterar `PaymentFlow.tsx`**

- Adicionar props: `workspaceId`, `customerName`, `customerDocument`
- **PIX**: Trocar `supabase.functions.invoke("member-purchase")` por `fetch("/api/member-purchase", ...)` enviando `workspace_id`
- **Cartão**: Além de abrir o link, também chamar `/api/member-purchase` com `payment_method: "cartao"` para registrar a transação pendente
- **Boleto**: 
  - Ao abrir o step de boleto, buscar dados existentes do cliente via `/api/member-purchase/customer-info?phone=X&workspace_id=Y` (nova sub-rota que consulta `transactions` por `customer_phone` para pegar `customer_name` e `customer_document`)
  - Se encontrar dados, mostrar: "Posso gerar o seu boleto com essas informações?" com os dados pré-preenchidos e botão "Confirmar"
  - Se não encontrar dados suficientes, mostrar os campos vazios para preenchimento
  - Ao confirmar/submeter, chamar `/api/member-purchase` com `payment_method: "boleto"` para criar a transação E depois chamar o webhook do boleto como já faz hoje

**4. Atualizar chamadas no `LockedOfferCard` e `PhysicalProductShowcase`**

Passar `workspaceId` para o `PaymentFlow` (já disponível como prop em ambos os componentes).

**5. Remover dependência da edge function `member-purchase`**

A edge function pode ser mantida mas não será mais chamada pelo frontend VPS.

### Resultado
- Todas as formas de pagamento (PIX, Cartão, Boleto) criarão transações reais na tabela `transactions` com `user_id` e `workspace_id` corretos
- Boleto pré-preenche dados do cliente quando disponíveis, perguntando confirmação
- Transações aparecem corretamente na aba de transações do painel

