

## Plano — 5 Correções Integradas

### 1. Follow Up usando número bruto em vez de normalizado

**Problema**: Na linha 447 de `followup-daily.ts`, o sistema pega `boleto.customer_phone` direto da tabela `transactions` e passa por `normalizePhone`. Mas muitos números chegam em formatos inconsistentes (ex: `073998341528`, `47999338941`, `31999759987`). O `normalizePhone` só adiciona `55` para 10-11 dígitos — números com `0` na frente (ex: `073...` = 12 dígitos após strip de `0` = 11 dígitos) funcionam, mas outros padrões falham.

**Correção em `deploy/backend/src/routes/followup-daily.ts`**:
- Após normalizar o `customer_phone`, tentar cruzar com a tabela `conversations` usando os últimos 8 dígitos (mesma lógica do frontend `useLeads.ts`)
- Se encontrar uma conversa com telefone normalizado, usar esse telefone em vez do bruto da transação
- Isso garante que o número usado no envio é o mesmo que aparece no lead

### 2. Editar telefone da transação no card do Lead

**Problema**: Não é possível corrigir o telefone de uma transação específica pelo card do lead.

**Correção em `src/components/leads/LeadDetailDialog.tsx`**:
- Modificar `TxCard` para aceitar um callback `onPhoneEdit`
- Adicionar botão de edição (ícone lápis) que mostra um input inline com o telefone atual
- Ao salvar, fazer `UPDATE transactions SET customer_phone = ? WHERE id = ?` via Supabase
- Invalidar queries de leads e transactions
- Exibir o `customer_phone` atual no card para visibilidade

### 3. Layout da fila de conexões saindo do popup

**Correção em `src/components/settings/ConnectionsSection.tsx`** (linha 709):
- Adicionar `overflow-hidden` no `DialogContent`
- Os containers dos labels (linhas 744, 751) já têm `truncate flex-1`, mas falta `min-w-0` no container pai flex para que o truncamento funcione

### 4. Botão "Executar agora" dentro do dialog "Automático"

**Correção em `FollowUpDashboard.tsx` e `FollowUpSettingsDialog.tsx`**:
- Remover o botão do header do dashboard
- Adicionar dentro do dialog do "Automático" com separador e feedback do resultado

### 5. Banner de status do Follow Up

**Correção em `FollowUpDashboard.tsx`**:
- Banner visual com estados: Em progresso, Concluído, Falha, Agendado, Inativo

### Arquivos modificados
- `deploy/backend/src/routes/followup-daily.ts` — cruzar telefone com conversations
- `src/components/leads/LeadDetailDialog.tsx` — edição de telefone na transação
- `src/components/settings/ConnectionsSection.tsx` — overflow fix
- `src/components/followup/FollowUpDashboard.tsx` — mover botão, banner de status
- `src/components/followup/FollowUpSettingsDialog.tsx` — receber botão "Executar agora"

### Validação VPS após deploy
```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "SELECT customer_phone, id FROM transactions WHERE type='boleto' AND status='pendente' LIMIT 10;"
docker compose logs backend --tail=100 | grep followup-daily
```

