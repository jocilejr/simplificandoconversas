

# Evitar inconsistência de valores: engenharia reversa por CPF no backend + flag na entrega digital

## Problema
1. PIX chega via webhook com CPF mas sem telefone (órfã)
2. `useLeads` já conta essa transação via match de CPF → valor aparece no lead
3. Na entrega digital, ao vincular essa transação ao telefone do lead, o `customer_phone` é preenchido → `useLeads` agora também encontra a transação via telefone, mas como deduplica por `id`, **não duplica**
4. **Porém**, o verdadeiro problema é: se o sistema no futuro ou em outro fluxo criar uma **nova** transação ao invés de vincular a existente, aí sim duplica

A solução real é simples e envolve duas partes:

## Parte 1: Backend — Engenharia reversa por CPF ao receber PIX (VPS)

Nos webhooks de pagamento (`payment-openpix.ts`, `payment.ts`, `manual-payment-webhook.ts`), quando uma transação PIX é criada/aprovada **com CPF mas sem telefone**, o backend faz:

1. Buscar nas transações existentes do mesmo workspace se já existe alguma transação com esse `customer_document` (CPF) **que tenha** `customer_phone`
2. Se encontrar → copiar o `customer_phone` para a nova transação (auto-vinculação)
3. Resultado: a transação já chega vinculada ao lead, sem necessidade de intervenção manual na entrega digital

Isso é feito adicionando uma função auxiliar em `deploy/backend/src/lib/resolve-phone-by-cpf.ts`.

## Parte 2: Frontend — Flag visual na entrega digital

Em `DeliveryFlowDialog.tsx`:

1. Ao abrir a lista de transações PIX, buscar o CPF do lead digitado (via transações existentes com aquele telefone)
2. Novo estado `leadCpf`
3. Na lista de transações:
   - **Com `customer_phone` preenchido** → badge azul "Vinculada", desabilitada (já existe)
   - **Sem `customer_phone` mas CPF = leadCpf** → badge verde "Já contabilizada", **clicável** mas ao processar **não** faz update no `customer_phone` da transação (só libera acesso na área de membros)
   - **Sem `customer_phone` e CPF ≠ leadCpf** → clicável normal, faz vinculação completa
4. No `processDelivery`, receber flag `alreadyCounted`:
   - `true`: apenas `member_products.upsert` + `delivery_link_generations.insert` + gerar link
   - `false`: faz tudo + `transactions.update` com `customer_phone`

## Arquivos alterados
- `deploy/backend/src/lib/resolve-phone-by-cpf.ts` — nova função auxiliar
- `deploy/backend/src/routes/payment-openpix.ts` — chamar resolve após insert/update de transação aprovada
- `deploy/backend/src/routes/payment.ts` — idem
- `deploy/backend/src/routes/manual-payment-webhook.ts` — idem
- `src/components/entrega/DeliveryFlowDialog.tsx` — flag visual + lógica condicional

