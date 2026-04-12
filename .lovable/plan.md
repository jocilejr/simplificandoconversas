

## Plano: Corrigir deduplicação do Follow Up + adicionar coluna de status de envio

### Problema confirmado
Linha 259: `phone.slice(-8)` agrupa telefones diferentes como duplicatas. Com `max_messages_per_phone_per_day = 1`, metade dos boletos é descartada silenciosamente. Além disso, o `phoneSendCount` começa vazio e não considera contatos já enviados hoje.

### Correções

**1. Backend — `deploy/backend/src/routes/followup-daily.ts`**

- Trocar `phone.slice(-8)` por telefone completo normalizado (linha 259)
- Pré-popular `phoneSendCount` com contatos já enviados hoje consultando o banco
- Adicionar contadores detalhados por motivo de skip:
  - `skipped_no_rule` — sem régua aplicável
  - `skipped_already_contacted` — já contactado hoje
  - `skipped_invalid_phone` — telefone inválido
  - `skipped_phone_limit` — limite por telefone atingido
  - `skipped_no_blocks` — régua sem conteúdo
- Registrar resultado do envio na tabela `boleto_recovery_contacts` com campo `notes` detalhado incluindo status (`sent`, `failed_api`, `skipped_duplicate`, etc.)
- Log de resumo final com todos os contadores

**2. Frontend — Coluna "Envio" na tabela "Hoje"**

Arquivo: `src/components/followup/FollowUpDashboard.tsx`

Na aba "Hoje", adicionar uma coluna **Envio** entre "Status" e "Ações" com badges visuais:

| Badge | Cor | Significado |
|-------|-----|-------------|
| ✅ Enviado | Verde | `contactedToday = true` e notes contém "sent" ou não contém "failed" |
| ⏳ Pendente | Amarelo | Ainda não processado (`contactedToday = false`) |
| 🔄 Duplicado | Cinza | notes contém "skipped_duplicate" ou "skipped_phone_limit" |
| ❌ Falha API | Vermelho | notes contém "failed" |

**3. Hook — `src/hooks/useBoletoRecovery.ts`**

- Expandir a query de `todayContacts` para incluir `notes` além de `transaction_id, rule_id`
- Criar um mapa `contactNotes: Map<string, string>` para expor o motivo do contato
- Adicionar campo `sendStatus` ao tipo `BoletoWithRecovery`: `"pending" | "sent" | "failed" | "skipped_duplicate"`

### Arquivos a alterar
- `deploy/backend/src/routes/followup-daily.ts`
- `src/hooks/useBoletoRecovery.ts`
- `src/components/followup/FollowUpDashboard.tsx`

### Resultado esperado
- Todos os boletos elegíveis são processados (sem falsos positivos de deduplicação)
- A coluna "Envio" mostra em tempo real o que aconteceu com cada boleto
- Diagnóstico futuro é instantâneo pela UI, sem precisar abrir logs

