## Fase 3 Revisada: IA na Extensão (Toggle Manual + IA Escuta)

Baseado no seu feedback, o sistema de IA terá **duas funcionalidades distintas**, ambas controladas manualmente pela extensão Chrome:

---

### Funcionalidade 1: IA Auto-Resposta (toggle por contato na sidebar)

**Como funciona:**

- Na aba "Contato" da sidebar, aparece um toggle "IA Responde" ao lado do contato
- O toggle só pode ser ativado se **nenhum fluxo estiver ativo** para aquele contato (senão fica desabilitado com tooltip explicando)
- Ao ativar, salva no banco que aquele `remote_jid` + `instance_name` tem IA ativa
- No webhook, ao receber mensagem inbound: se IA ativa para aquele contato E nenhum fluxo rodando → chama OpenAI com o histórico e responde automaticamente
- Ao desativar, para de responder

**Banco de dados — nova tabela `ai_auto_reply_contacts`:**

```sql
CREATE TABLE public.ai_auto_reply_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  instance_name text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, remote_jid, instance_name)
);
-- RLS: users manage own
```

### Funcionalidade 2: IA Escuta (cria lembretes automaticamente)

**Como funciona:**

- Toggle separado na sidebar: "IA Escuta"
- Esta função é ativada de forma automática, a cada mensagem inbound o sistema envia o conteúdo para a IA com instruções configuráveis
- A IA analisa a mensagem e, **somente se detectar algo relevante conforme as regras do usuário**, cria um lembrete automaticamente na tabela `reminders`
- Exemplo de regra: "Detecte menções a pagamentos, prazos, datas de vencimento, promessas de pagamento"
- Se a IA não detectar nada relevante, ignora silenciosamente (não salva nada)

**Configuração (Settings > IA no painel web):**

- System prompt da IA de resposta (como ela deve responder)
- Regras de escuta (o que a IA deve monitorar e criar lembretes) — textarea com instruções
- Ambos salvos na tabela de perfil ou em nova tabela de config

**Banco de dados — expandir `profiles` ou nova tabela `ai_config`:**

```sql
CREATE TABLE public.ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reply_system_prompt text DEFAULT 'Você é um assistente de vendas profissional...',
  listen_rules text DEFAULT 'Detecte menções a pagamentos, datas, prazos e promessas...',
  max_context_messages int DEFAULT 10,
  created_at timestamptz DEFAULT now()
);
-- RLS: users manage own
```

---

### Mudanças por arquivo


| Arquivo                | Mudança                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Migration SQL**      | Criar `ai_auto_reply_contacts` e `ai_config` com RLS                                                                                        |
| `**extension-api.ts**` | Novos endpoints: `POST/DELETE /ai-reply-toggle`, `POST/DELETE /ai-listen-toggle`, `GET /ai-status?phone=X`                                  |
| `**webhook.ts**`       | Após fluxos, chamar `checkAndAutoReply` (se toggle ativo) e `checkAndAutoListen` (se toggle ativo) — ambos usam OpenAI do perfil do usuário |
| `**background.js**`    | Novos actions: `ai-reply-toggle`, `ai-listen-toggle`, `ai-status`                                                                           |
| `**content.js**`       | Na aba Contato: dois toggles (IA Responde + IA Escuta) com estado visual, desabilitados se fluxo ativo                                      |
| `**AISection.tsx**`    | Expandir com: textarea para system prompt de resposta, textarea para regras de escuta, slider de contexto                                   |


### Fluxo no webhook (ordem de prioridade)

```text
Mensagem inbound recebida
  ├─ checkAndResumeWaitingReply → se retomou, PARA
  ├─ checkAndTriggerFlows → se disparou fluxo, PARA
  ├─ checkAndAutoReply → se toggle ativo E sem fluxo → responde via OpenAI
  └─ checkAndAutoListen → se toggle ativo → analisa e cria lembrete SE relevante
```

Note que `autoListen` roda **independentemente** do `autoReply` — pode ter escuta ativa sem resposta automática.