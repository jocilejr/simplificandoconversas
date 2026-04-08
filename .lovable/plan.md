

# Follow Up Automático via Fila de Mensagens

## Problemas identificados

1. **Nenhum backend para follow-up diário** -- A tabela `followup_settings` existe com `send_at_hour`, `instance_name` e `enabled`, mas **nenhum cron job ou endpoint** no backend processa o envio automático diário.
2. **Erro ao salvar configurações** -- O hook `useFollowUpSettings` usa `as any` casts e pode estar falhando por incompatibilidade de tipos ou RLS.

## Solução

### 1. Backend: Criar endpoint e cron para follow-up diário
**Arquivo novo: `deploy/backend/src/routes/followup-daily.ts`**

Endpoint `POST /api/followup-daily/process`:
- Busca todos os `followup_settings` onde `enabled = true`
- Para cada workspace com follow-up ativo:
  - Carrega todos os boletos pendentes (`transactions` where `type=boleto`, `status=pendente`)
  - Carrega as `boleto_recovery_rules` ativas do workspace
  - Carrega o `boleto_settings` (para calcular `dueDate`)
  - Para cada boleto, calcula qual regra se aplica HOJE (mesma lógica do frontend: `days_after_generation`, `days_before_due`, `days_after_due`)
  - Verifica se já foi contactado hoje para essa regra (tabela `boleto_recovery_contacts`)
  - Se não foi contactado e tem regra aplicável:
    - Monta a mensagem usando o template da regra (com variáveis `{saudação}`, `{primeiro_nome}`, `{valor}`, `{vencimento}`, `{codigo_barras}`)
    - Carrega `message_queue_config` da instância para delay/cooldown
    - Enfileira na `MessageQueue` da instância configurada
    - Ao enviar com sucesso, registra em `boleto_recovery_contacts` (para marcar como "enviado hoje")
  - Também suporta `media_blocks` (PDF e imagem do boleto) na régua

### 2. Backend: Registrar cron no `index.ts`
**Arquivo: `deploy/backend/src/index.ts`**

Adicionar cron que roda a cada minuto e compara o horário atual (Brasília) com `send_at_hour`:
```
cron.schedule("* * * * *", async () => {
  // Verifica se algum workspace tem send_at_hour == hora atual de Brasília
  // Se sim, chama processFollowUpDaily() para esse workspace
});
```
Também registrar a rota `app.use("/api/followup-daily", followupDailyRouter)`.

### 3. Frontend: Corrigir erros ao salvar `FollowUpSettingsDialog`
**Arquivo: `src/hooks/useFollowUpSettings.ts`**

O problema provável é que o `update` não inclui `updated_at` ou o tipo do `send_at_hour` não bate. Vou:
- Adicionar `updated_at: new Date().toISOString()` ao update
- Garantir que os campos enviados correspondem exatamente às colunas da tabela
- Adicionar tratamento de erro com log para debug

**Arquivo: `src/components/followup/FollowUpSettingsDialog.tsx`**
- Adicionar `onError` com `toast.error(err.message)` para mostrar o erro real ao usuário

## Lógica da régua (absoluta, por contato)

Cada boleto é tratado individualmente:
1. Calcula `daysSinceGeneration` = dias entre `created_at` e hoje
2. Calcula `dueDate` = `created_at + default_expiration_days`
3. Calcula `daysUntilDue` e `daysAfterDue`
4. Itera as regras ordenadas por `priority`
5. Primeira regra que bate com o dia do contato = mensagem a enviar
6. Se já contactado hoje para essa regra, pula

## Arquivos alterados
1. **`deploy/backend/src/routes/followup-daily.ts`** (novo) -- Lógica de processamento diário
2. **`deploy/backend/src/index.ts`** -- Registrar rota + cron a cada minuto
3. **`src/hooks/useFollowUpSettings.ts`** -- Corrigir mutation
4. **`src/components/followup/FollowUpSettingsDialog.tsx`** -- Mostrar erro real

## Deploy
```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

Verificar nos logs:
```bash
docker compose logs -f backend | grep -i "followup-daily\|follow.up"
```

