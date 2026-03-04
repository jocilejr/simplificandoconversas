

## Plano: Link Rastreável com Continuação de Funil (waitForClick)

### Conceito

Novo tipo de nó **"Aguardar Clique"** (`waitForClick`) que:
1. O usuário configura uma URL original (ex: `https://mc.ht/s/XXXXXX`)
2. Na execução, o sistema gera um link rastreável único (ex: `https://{supabase_url}/functions/v1/link-redirect?code=abc123`)
3. Envia o link rastreável ao contato via WhatsApp
4. **Pausa o fluxo** até o contato clicar no link
5. Ao clicar, redireciona para a URL original, marca como clicado, e **retoma o fluxo** a partir do próximo nó
6. Cliques subsequentes apenas redirecionam sem re-executar o fluxo

### Mudanças necessárias

#### 1. Nova tabela `tracked_links` (migração SQL)

```sql
CREATE TABLE public.tracked_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flow_id uuid NOT NULL,
  execution_id uuid,
  remote_jid text NOT NULL,
  original_url text NOT NULL,
  short_code text UNIQUE NOT NULL,
  clicked boolean DEFAULT false,
  clicked_at timestamptz,
  next_node_id text,
  conversation_id uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tracked_links ENABLE ROW LEVEL SECURITY;
-- RLS: users can view own links
CREATE POLICY "Users can view own tracked_links" ON public.tracked_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tracked_links" ON public.tracked_links FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### 2. Nova edge function `link-redirect`

- Recebe `GET ?code=abc123`
- Busca o `tracked_links` pelo `short_code`
- Se `clicked = false`: marca como `clicked = true`, dispara continuação do fluxo (chama `execute-flow` com parâmetro `resumeFromNodeId`)
- Redireciona (HTTP 302) para `original_url`
- Se já clicado: apenas redireciona sem re-executar

#### 3. Novo tipo de nó `waitForClick` em `src/types/chatbot.ts`

- Adicionar ao `FlowNodeType`: `"waitForClick"`
- Propriedades: `clickUrl` (URL original), `clickMessage` (texto opcional enviado junto com o link), `clickTimeout` (segundos, 0 = sem timeout)
- Config no `nodeTypeConfig` com label "Aguardar Clique", ícone `Link`, cor `#0ea5e9`

#### 4. Campos no `PropertiesPanel.tsx`

- Campo "URL de destino" (input)
- Campo "Mensagem" (textarea, onde `{{link}}` é substituído pelo link rastreável)
- Campo "Timeout" (segundos)

#### 5. Modificação em `execute-flow/index.ts`

- No handler do `waitForClick`:
  1. Gerar `short_code` único
  2. Inserir na tabela `tracked_links` com `next_node_id` = próximo nó na fila
  3. Construir URL rastreável
  4. Substituir `{{link}}` na mensagem pelo link rastreável
  5. Enviar mensagem via Evolution API
  6. **Parar execução** neste ponto (marcar execução como `waiting_click`)
- Adicionar suporte a `resumeFromNodeId` no início da função para retomar de um nó específico

#### 6. Preview no `GroupNode.tsx`

- Renderizar como pill compacto com ícone de link + URL truncada, similar ao `waitDelay`

### Arquivos editados

- `src/types/chatbot.ts` — novo tipo + config
- `src/components/chatbot/PropertiesPanel.tsx` — campos do nó
- `src/components/chatbot/GroupNode.tsx` — preview visual
- `src/components/chatbot/NodePalette.tsx` — adicionar à paleta
- `supabase/functions/execute-flow/index.ts` — lógica de pausa/retomada
- `supabase/functions/link-redirect/index.ts` — nova edge function (redirect + trigger)
- Migração SQL — tabela `tracked_links`

