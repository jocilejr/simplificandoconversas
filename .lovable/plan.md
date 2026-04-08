

# Indicadores visuais no botão de recuperação

## O que será feito

### 1. Contador de mensagens enviadas (manual + automático)
O contador no botão de recuperação (badge) atualmente conta apenas cliques manuais via `recovery_clicks`. Será alterado para **também contar envios automáticos** da `recovery_queue` (status = "sent").

**Mudança no frontend:**
- `useRecoveryClicks.ts`: Além de buscar `recovery_clicks`, também buscar `recovery_queue` com `status = 'sent'` para os mesmos `transaction_ids`. Combinar as contagens.
- O badge no `RecoveryPopover` já exibe `clickCount` — apenas a fonte de dados muda.

### 2. Indicador visual de número válido no WhatsApp
Verificar na **criação da transação** (backend) se o número existe no WhatsApp e salvar o resultado no banco.

**Migração SQL:**
```sql
ALTER TABLE transactions ADD COLUMN whatsapp_valid boolean DEFAULT null;
```

**Backend — `deploy/backend/src/routes/platform-api.ts` e `payment.ts`:**
Após salvar a transação com telefone, chamar a Evolution API para verificar:
```
POST /chat/whatsappNumbers/{instanceName}
body: { numbers: ["5511999999999"] }
```
Salvar o resultado (`true`/`false`) na coluna `whatsapp_valid` da transação.

**Frontend — `TransactionsTable.tsx`:**
Na coluna de contato (telefone), exibir um ícone pequeno:
- ● verde se `whatsapp_valid === true`
- ● vermelho se `whatsapp_valid === false`  
- Sem ícone se `null` (transações antigas sem verificação)

### 3. Instância para verificação
Usará a instância configurada em `recovery_settings` (a mesma usada para envio), determinada pelo tipo da transação (`instance_boleto`, `instance_pix`, etc.).

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar coluna `whatsapp_valid` na tabela `transactions` |
| `deploy/backend/src/routes/platform-api.ts` | Verificar número no WhatsApp após criar transação |
| `deploy/backend/src/routes/payment.ts` | Verificar número no WhatsApp após criar transação |
| `deploy/backend/src/lib/recovery-dispatch.ts` | Extrair função de verificação de número para reutilização |
| `src/hooks/useRecoveryClicks.ts` | Combinar contagem de `recovery_clicks` + `recovery_queue` (sent) |
| `src/components/transactions/TransactionsTable.tsx` | Exibir indicador visual de WhatsApp válido na coluna de contato |
| `src/hooks/useTransactions.ts` | Interface `Transaction` já inclui novos campos via types auto-gerado |

