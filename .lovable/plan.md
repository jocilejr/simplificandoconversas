

# Corrigir Isolamento de Leads por Workspace

## Diagnóstico

As queries do `useLeads` já filtram por `workspace_id` nas tabelas `conversations`, `transactions`, `contact_tags` e `reminders`. Se leads estão aparecendo no workspace errado, o problema é que **os dados existentes no banco estão com `workspace_id` errado** — provavelmente conversas ou transações criadas antes da migração multi-tenant, ou instâncias sem `workspace_id` populado (causando fallback para o primeiro workspace do usuário).

A correção nos hooks de pagamento (enviar `workspaceId` pelo frontend) é válida mas **não resolve o problema de leads** porque leads vêm de `conversations`, não de pagamentos. A vinculação correta deve ser feita **exclusivamente pelo backend** a partir da instância WhatsApp.

## Alterações

### 1. Reverter hooks de pagamento ao estado anterior

**`src/hooks/useCreatePayment.ts`**
- Remover `useWorkspace` e o envio de `workspaceId` no body

**`src/hooks/useCreatePaymentOpenpix.ts`**
- Remover `useWorkspace` e o envio de `workspaceId` no body

### 2. Backend: payment routes devem resolver workspace pela instância

**`deploy/backend/src/routes/payment.ts`**
- Na rota `/create`, após identificar o usuário, buscar a instância ativa do workspace via a tabela `whatsapp_instances` usando o `customer_phone` para encontrar a conversa e seu `workspace_id`
- Fallback: usar `resolveWorkspaceId(userId)` apenas se não encontrar

**`deploy/backend/src/routes/payment-openpix.ts`**
- Mesma lógica: resolver workspace a partir da conversa existente com aquele telefone

### 3. Script SQL para corrigir dados existentes na VPS

Fornecer um script que o usuário executa na VPS para:
- Atualizar `conversations` com `workspace_id` errado, usando o `workspace_id` correto da tabela `whatsapp_instances` baseado no `instance_name`
- Atualizar `transactions` com `workspace_id` errado, cruzando pelo telefone com a conversa correta

```sql
-- Corrigir conversations usando workspace_id da instância vinculada
UPDATE conversations c
SET workspace_id = wi.workspace_id
FROM whatsapp_instances wi
WHERE c.instance_name = wi.instance_name
  AND c.workspace_id != wi.workspace_id;

-- Corrigir transactions cruzando com conversations pelo telefone
UPDATE transactions t
SET workspace_id = c.workspace_id
FROM conversations c
WHERE c.phone_number IS NOT NULL
  AND t.customer_phone IS NOT NULL
  AND RIGHT(regexp_replace(c.phone_number, '\D', '', 'g'), 8) = RIGHT(regexp_replace(t.customer_phone, '\D', '', 'g'), 8)
  AND t.workspace_id != c.workspace_id;
```

### 4. Instruções de investigação para a VPS

Fornecer comandos para o usuário verificar na VPS:
- Quantas conversas existem com workspace_id diferente do esperado
- Quantas instâncias não têm workspace_id definido

## Resumo
- 2 arquivos frontend revertidos (hooks de pagamento)
- 2 arquivos backend ajustados (resolver workspace sem depender do frontend)
- Script SQL de correção de dados para rodar na VPS

