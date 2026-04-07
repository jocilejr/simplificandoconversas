

## Nova Página de Follow Up (baseada no Finance Hub)

A página /follow-up será uma réplica adaptada da seção de Recuperação do Finance Hub, com dashboard completo de boletos pendentes, régua de cobrança configurável, fila de recuperação em modo tinder, e hero card com progresso diário.

---

### Novas tabelas no banco (migração)

Três tabelas precisam ser criadas na VPS:

1. **`boleto_settings`** — configuração de dias para vencimento
   - `id`, `workspace_id`, `user_id`, `default_expiration_days` (default 3)

2. **`boleto_recovery_rules`** — régua de cobrança com regras configuráveis
   - `id`, `workspace_id`, `user_id`, `name`, `rule_type` (enum: days_after_generation, days_before_due, days_after_due), `days`, `message`, `is_active`, `priority`, `media_blocks` (jsonb)

3. **`boleto_recovery_contacts`** — rastreamento de contatos realizados por regra
   - `id`, `workspace_id`, `user_id`, `transaction_id`, `rule_id`, `notes`, `created_at`

Todas com RLS padrão do workspace (ws_select, ws_insert, ws_update, ws_delete).

---

### Novos arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useBoletoRecovery.ts` | Hook que busca boletos pendentes, regras ativas, contatos do dia, e calcula vencimento/regra aplicável para cada boleto |
| `src/components/followup/FollowUpHeroCard.tsx` | Card principal com stats do dia (valor a recuperar, enviados, resolvidos, progresso) |
| `src/components/followup/FollowUpRulesConfig.tsx` | Dialog de configuração da régua de cobrança (criar/editar/remover regras com variáveis e mídia) |
| `src/components/followup/FollowUpQueue.tsx` | Modal estilo tinder para percorrer boletos pendentes um a um (WhatsApp, copiar, marcar contactado, pular, deletar) |
| `src/components/followup/FollowUpDashboard.tsx` | Dashboard principal com tabs Hoje/Pendentes/Vencidos/Todos, busca, lista de boletos |
| `src/pages/FollowUp.tsx` | Página que monta BoletoAutoRecoveryToggle + FollowUpDashboard |

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/AppSidebar.tsx` | Adicionar item "Follow Up" na seção Financeiro |
| `src/App.tsx` | Adicionar rota `/follow-up` com PermissionGate |
| `src/hooks/useWorkspace.tsx` | Adicionar permissão `follow_up` se necessário |

---

### Funcionalidades principais

1. **Hero Card** — mostra boletos do dia (baseados nas regras), valor total a recuperar, progresso (enviados/total), botão "Iniciar Recuperação" e "Configurar Régua"

2. **Tabs de boletos**:
   - **Hoje**: boletos que têm uma regra ativa aplicável para o dia
   - **Pendentes**: boletos não vencidos
   - **Vencidos**: boletos com vencimento passado
   - **Todos**: todos os boletos não pagos

3. **Régua de cobrança**: configuração de regras tipo "1 dia após geração", "1 dia antes do vencimento", "2 dias após vencimento" com mensagem personalizada usando variáveis ({saudação}, {nome}, {primeiro_nome}, {valor}, {vencimento}, {codigo_barras})

4. **Modo Recuperação (Queue)**: modal que navega pelos boletos pendentes do dia um a um, com preview da mensagem formatada, botões de WhatsApp, copiar, marcar como contactado e pular

5. **Busca**: filtro por nome, telefone, email ou código de barras

---

### Fluxo de dados

O hook `useBoletoRecovery` busca:
- Todos os boletos com `type = 'boleto'` e status diferente de pago/cancelado/expirado
- Regras ativas da `boleto_recovery_rules`
- Contatos já feitos hoje na `boleto_recovery_contacts`
- Configuração de vencimento da `boleto_settings`

Calcula para cada boleto: data de vencimento, dias até vencer, regra aplicável, se já foi contactado hoje, e formata a mensagem com as variáveis.

---

### VPS

Após implementação, rodar na VPS:
```bash
docker compose exec -T postgres psql -U postgres -d postgres < migration.sql
docker compose up -d --build backend
```

O SQL da migração será fornecido junto com as instruções.

