

# Yampi Webhook: user_id automático + ID interno + CPF no exemplo

## Resumo

Três mudanças:
1. **`user_id` automático** — derivado do `workspace_id` (busca `created_by` na tabela `workspaces`), igual ao `manual-payment-webhook.ts`
2. **`external_id` gerado internamente** — quando `resource.number` ou `resource.id` não vierem no payload, o sistema gera um UUID como fallback, garantindo deduplicação sem exigir dados do usuário
3. **CPF no exemplo** — adicionado ao payload de exemplo na UI

## Alterações

### 1. `deploy/backend/src/routes/yampi-webhook.ts`

- Remover `user_id` do body e da validação obrigatória (linhas 62, 72-75)
- Após validar `workspaceId`, buscar workspace no banco para obter `created_by`:
  ```ts
  const { data: ws } = await sb.from("workspaces")
    .select("id, created_by").eq("id", workspaceId).maybeSingle();
  if (!ws) return res.status(404).json({ error: "Workspace not found" });
  const userId = body.user_id || ws.created_by;
  ```
- Para `external_id`, usar fallback com crypto randomUUID quando `number`/`id` não vierem:
  ```ts
  const orderNumber = String(order.number || order.id || crypto.randomUUID());
  ```
- Mesma lógica para `transaction.payment.refused` e `cart.reminder`
- Atualizar JSDoc do topo do arquivo

### 2. `src/components/settings/IntegrationsSection.tsx`

- **Remover** bloco "Seu User ID" (linhas 392-413)
- **Remover** `user_id` da lista de campos obrigatórios (linha 420)
- **Atualizar** exemplo de payload JSON (linhas 436-451):
  - Remover `"user_id"`
  - Remover `"number": 12345`
  - Adicionar `"cpf": "12345678900"` dentro de `customer.data`

Payload final exibido na UI:
```json
{
  "event": "order.paid",
  "workspace_id": "seu-workspace-id",
  "resource": {
    "value_total": 149.90,
    "customer": {
      "data": {
        "name": "João Silva",
        "email": "joao@email.com",
        "phone": { "full_number": "11999998888" },
        "cpf": "12345678900"
      }
    }
  }
}
```

## Arquivos alterados
1. `deploy/backend/src/routes/yampi-webhook.ts`
2. `src/components/settings/IntegrationsSection.tsx`

