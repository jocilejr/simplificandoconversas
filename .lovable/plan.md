## Fila Global de Mensagens + Instancias Independentes para Follow Up

### Conceito

Centralizar o controle de delay entre mensagens em uma **Fila Global por Instancia** nas Configuracoes. Transacoes e Follow Up passam a configurar apenas **qual instancia usar**, sem definir delay — o delay vem da fila global.

### Nova tabela: `message_queue_config`

```sql
CREATE TABLE public.message_queue_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  instance_name text NOT NULL,
  delay_seconds integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, instance_name)
);
ALTER TABLE public.message_queue_config ENABLE ROW LEVEL SECURITY;
-- RLS policies ws_select, ws_insert, ws_update, ws_delete (padrao workspace)
```

### Nova tabela: `followup_settings`

```sql
CREATE TABLE public.followup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  instance_name text,
  send_after_minutes integer NOT NULL DEFAULT 5,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.followup_settings ENABLE ROW LEVEL SECURITY;
-- RLS policies ws_select, ws_insert, ws_update, ws_delete
```

### Estrutura visual

```text
CONFIGURACOES > Conexoes
  ┌─────────────────────────────────────────────┐
  │ Instancia "vendas"    [●Conectado]  ...     │
  │ Instancia "suporte"   [●Conectado]  ...     │
  └─────────────────────────────────────────────┘

  ┌─ Fila de Mensagens ────────────────────────┐
  │  Instancia       │ Delay entre msgs         │
  │  vendas          │ [30] seg                  │
  │  suporte         │ [45] seg                  │
  │  (auto-criado para cada instancia ativa)    │
  └────────────────────────────────────────────┘

TRANSACOES > Config (⚙)
  - Instancia Boleto: [select]
  - Instancia PIX:    [select]
  - Instancia Yampi:  [select]
  (SEM campo de delay ou de espera — vem da fila global)

FOLLOW UP > Config (⚙)
  - Instancia: [select]
  - Espera antes de enviar: [5] min
  (SEM campo de delay — vem da fila global)
```

### Mudancas por arquivo


| Arquivo                                              | Acao                                                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Migration SQL**                                    | Criar tabelas `message_queue_config` e `followup_settings` com RLS                                              |
| `src/hooks/useMessageQueueConfig.ts`                 | **Novo** — hook CRUD para `message_queue_config`                                                                |
| `src/hooks/useFollowUpSettings.ts`                   | **Novo** — hook CRUD para `followup_settings`                                                                   |
| `src/components/settings/ConnectionsSection.tsx`     | Adicionar secao "Fila de Mensagens" abaixo das instancias — lista instancias ativas com campo de delay editavel |
| `src/components/transactions/AutoRecoveryConfig.tsx` | Remover campo "Delay entre mensagens" — manter apenas selecao de instancias e "Espera antes de enviar"          |
| `src/components/followup/FollowUpDashboard.tsx`      | Adicionar botao de config (⚙) que abre modal de selecao de instancia para follow up                             |
| `src/components/followup/FollowUpSettingsDialog.tsx` | **Novo** — modal com select de instancia + espera antes de enviar + toggle enabled                              |
| `deploy/backend/src/routes/auto-recovery.ts`         | Ler delay da `message_queue_config` ao inves de `recovery_settings.delay_seconds`                               |
| `deploy/backend/src/lib/message-queue.ts`            | Sem mudanca (ja funciona por instancia) — o backend le o delay da tabela ao processar                           |


### Fluxo do backend (processRecoveryQueue)

1. Ao processar um item da fila, busca o `delay_seconds` de `message_queue_config` para a instancia que sera usada
2. Se nao encontrar config, usa fallback de 30 segundos
3. Mesmo principio se aplica ao futuro processamento automatico de follow up

### Detalhes

- A secao "Fila de Mensagens" nas Configuracoes mostra automaticamente todas as instancias ativas do workspace
- Ao criar uma instancia nova, nao precisa pre-criar o registro — o hook usa upsert
- O campo `delay_seconds` e removido de `recovery_settings` na interface (campo fica no banco para compatibilidade, mas nao e mais usado)
- O backend passa a consultar `message_queue_config` para determinar o delay