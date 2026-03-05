

## Timeout com Fallback para "Esperar Resposta" e "Esperar Clique"

Implementar funcionalidade estilo ManyChat onde, se o contato não responder ou clicar dentro de um tempo configurado, o fluxo segue por um caminho alternativo (saída de timeout).

### Mudanças necessárias

**1. Tipos e dados (src/types/chatbot.ts)**
- Adicionar campos `timeoutUnit` ("seconds" | "minutes" | "hours") ao `FlowNodeData` para `waitForReply` e `waitForClick`
- Adicionar `timeoutNodeId` (armazenado nas edges, não no data)
- Atualizar `defaultNodeData` para incluir `timeoutUnit: "minutes"`
- Marcar `waitForReply` e `waitForClick` como nós com múltiplas saídas (2 handles: "responded/clicked" e "timeout")

**2. Renderização do nó (src/components/chatbot/StepNode.tsx)**
- `waitForReply` e `waitForClick` ganham 2 handles de saída quando timeout > 0:
  - Handle superior: "Próximo Passo" (caminho normal)
  - Handle inferior: "Se não respondeu" / "Se não clicou" (caminho timeout) com label e cor vermelha/laranja
- Labels visíveis ao lado dos handles indicando cada caminho

**3. Painel de propriedades (src/components/chatbot/PropertiesPanel.tsx)**
- Para `waitForReply`: substituir o campo de timeout por um grupo com input numérico + seletor de unidade (segundos/minutos/horas)
- Para `waitForClick`: mesmo tratamento
- Remover o campo "Mensagem de fallback" do waitForReply (o fallback agora é um caminho visual no fluxo)

**4. Banco de dados — nova tabela `flow_timeouts`**
```sql
CREATE TABLE public.flow_timeouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES flow_executions(id) ON DELETE CASCADE NOT NULL,
  flow_id uuid REFERENCES chatbot_flows(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  remote_jid text NOT NULL,
  conversation_id uuid,
  timeout_node_id text NOT NULL,
  timeout_at timestamptz NOT NULL,
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.flow_timeouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own timeouts" ON public.flow_timeouts FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_flow_timeouts_pending ON public.flow_timeouts (processed, timeout_at) WHERE NOT processed;
```

**5. Edge Function: `check-timeouts` (nova)**
- Invocada periodicamente (via cron ou polling a cada 30s)
- Busca timeouts onde `timeout_at <= now()` e `processed = false`
- Para cada timeout pendente:
  - Marca execução original como "completed"
  - Inicia nova execução do fluxo a partir do `timeout_node_id`
  - Marca timeout como `processed = true`

**6. Edge Function: `execute-flow` (atualizar)**
- Quando processar `waitForReply` com timeout > 0:
  - Calcular `timeout_at` baseado no valor + unidade
  - Buscar a edge com `sourceHandle: "output-1"` (saída de timeout) para determinar o `timeout_node_id`
  - Inserir registro em `flow_timeouts`
  - Mudar status da execução para `"waiting_reply"` e pausar
- Quando processar `waitForClick` com timeout > 0:
  - Mesmo comportamento, usando a saída de timeout
  - Inserir em `flow_timeouts`

**7. Webhook de resposta (evolution-webhook)**
- Quando receber mensagem de um contato com execução `waiting_reply`:
  - Marcar timeout correspondente como `processed = true` (cancelar)
  - Retomar fluxo pelo caminho normal (output-0)

**8. FlowEditor (src/components/chatbot/FlowEditor.tsx)**
- Ao conectar edges de nós com múltiplas saídas, armazenar `sourceHandle` para distinguir caminho normal vs timeout

### Fluxo visual no editor

```text
┌──────────────────────┐
│  Capturar Resposta   │
│  Timeout: 5 minutos  │
│                      │── Ação de resposta ──▶ [próximo nó]
│                      │
│                      │── Se não respondeu ──▶ [nó fallback]
└──────────────────────┘
```

### Resumo de arquivos alterados
- `src/types/chatbot.ts` — novos campos e múltiplas saídas
- `src/components/chatbot/StepNode.tsx` — handles duplos com labels
- `src/components/chatbot/PropertiesPanel.tsx` — seletor de unidade de tempo
- `supabase/functions/execute-flow/index.ts` — lógica de timeout
- `supabase/functions/evolution-webhook/index.ts` — cancelar timeout ao receber resposta
- `supabase/functions/check-timeouts/index.ts` — nova function para processar timeouts
- Migração SQL — tabela `flow_timeouts`

