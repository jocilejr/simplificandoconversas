

## Sistema de Fila de Recuperação Automática

### Conceito

Quando uma transação pendente/abandonada chega (Yampi, manual, etc.), ela é automaticamente inserida na tabela `recovery_queue`. Um cron no backend processa a fila **uma mensagem por vez**, respeitando o delay configurado. A fila é visível na UI.

```text
Webhook → Transação salva (pendente/abandonado)
              ↓
         INSERT na recovery_queue (status = "pending")
              ↓
Cron (10s) → Pega o PRIMEIRO item pending da fila
              ↓
         Envia via Evolution API (instância selecionada)
              ↓
         Marca como "sent" ou "failed"
              ↓
         Aguarda delay_seconds antes de processar o próximo
```

### 1. Migração: tabelas `recovery_settings` e `recovery_queue`

**`recovery_settings`** (1 por workspace):
- `id`, `workspace_id`, `user_id`
- `enabled` (boolean, default false)
- `instance_name` (text) - instância WhatsApp para envio
- `delay_seconds` (integer, default 20, min 20)
- `send_after_minutes` (integer, default 5) - esperar X minutos após criação da transação

**`recovery_queue`** (cada item = 1 mensagem a enviar):
- `id`, `workspace_id`, `user_id`
- `transaction_id` (uuid)
- `customer_phone` (text)
- `customer_name` (text)
- `amount` (numeric)
- `transaction_type` (text) - boleto/pix/cartao/yampi_cart
- `status` (text: pending/sent/failed/cancelled)
- `error_message` (text, nullable)
- `scheduled_at` (timestamptz) - quando pode ser enviada (created_at + send_after_minutes)
- `sent_at` (timestamptz, nullable)
- `created_at` (timestamptz)

RLS: políticas `ws_*` padrão.

### 2. Backend: enfileiramento automático no webhook

No `yampi-webhook.ts` e `manual-payment-webhook.ts`, após salvar transação com status pendente/abandonado/rejeitado:
- Buscar `recovery_settings` do workspace
- Se `enabled = true` e `customer_phone` existe → INSERT na `recovery_queue` com `scheduled_at = now() + send_after_minutes`

### 3. Backend: processador da fila (`auto-recovery.ts`)

Nova rota + cron a cada 10 segundos:
1. Busca **todos** os `recovery_settings` com `enabled = true`
2. Para cada workspace, busca o **primeiro** item da `recovery_queue` com `status = pending` e `scheduled_at <= now()`
3. Verifica se já passou `delay_seconds` desde o último envio (consultando o último `sent_at` do workspace)
4. Se sim, envia a mensagem via Evolution API usando a instância configurada
5. Marca como `sent` ou `failed`
6. **Só processa 1 por workspace por ciclo** - o próximo será no próximo ciclo do cron

Usa as mensagens de `profiles.recovery_message_boleto` / `recovery_message_pix` com substituição de variáveis ({saudação}, {nome}, {primeiro_nome}, {valor}).

### 4. Frontend: página de Recuperação atualizada

Na página `RecuperacaoBoletos.tsx`, adicionar no topo:

**Painel de configuração:**
- Toggle ativar/desativar envio automático
- Select da instância WhatsApp
- Input numérico para delay entre mensagens (mínimo 20s)
- Input para "aguardar X minutos" antes de enviar

**Visualização da fila:**
- Tabela mostrando os itens da `recovery_queue` (cliente, valor, tipo, status, agendado para, enviado em)
- Badge com contagem de itens pendentes
- Botão para cancelar itens pendentes

### 5. Registro no `migrate-workspace.sql`

Adicionar `recovery_settings` e `recovery_queue` nos arrays `_tables` do script de migração para garantir isolamento por workspace.

### Arquivos modificados/criados

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabelas `recovery_settings` e `recovery_queue` |
| `deploy/backend/src/routes/auto-recovery.ts` | Nova rota para processar fila |
| `deploy/backend/src/routes/yampi-webhook.ts` | Adicionar enfileiramento após salvar transação |
| `deploy/backend/src/routes/manual-payment-webhook.ts` | Adicionar enfileiramento após salvar transação |
| `deploy/backend/src/index.ts` | Registrar rota e cron |
| `src/pages/RecuperacaoBoletos.tsx` | UI de config + visualização da fila |
| `deploy/migrate-workspace.sql` | Registrar novas tabelas |

### Após deploy (VPS)

1. Rodar migração no banco
2. Atualizar backend com `update.sh`
3. Ativar na página de Recuperação, selecionar instância e definir delay

