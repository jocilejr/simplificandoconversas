

# Isolamento de Leads por Workspace

## Problema
Os hooks `useCreatePayment` e `useCreatePaymentOpenpix` não enviam `workspaceId` ao backend. O backend usa `resolveWorkspaceId(userId)` que retorna o **primeiro workspace** do usuário, fazendo transações aparecerem no workspace errado.

## Alterações

### 1. Frontend: enviar `workspaceId` nos hooks de pagamento

**`src/hooks/useCreatePayment.ts`**
- Importar `useWorkspace`
- Incluir `workspaceId` no body do fetch

**`src/hooks/useCreatePaymentOpenpix.ts`**
- Mesma alteração

### 2. Backend: usar `resolveWorkspaceIdFromRequest`

**`deploy/backend/src/routes/payment.ts`** (linha 3 e 153)
- Trocar import de `resolveWorkspaceId` para incluir `resolveWorkspaceIdFromRequest`
- Na rota `/create` (linha 153): trocar `resolveWorkspaceId(userId)` por `resolveWorkspaceIdFromRequest(req.body, userId)`

**`deploy/backend/src/routes/payment-openpix.ts`** (linha 3 e 41)
- Mesma troca: import e uso de `resolveWorkspaceIdFromRequest(req.body, userId)`

### Resumo
4 arquivos alterados. Após deploy na VPS, cada transação criada será vinculada ao workspace ativo no frontend.

