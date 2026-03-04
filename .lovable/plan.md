

## Reformulacao Completa da Tela de Conversas

### Problema 1: Design antiprofissional
A interface atual tem visual generico, sem hierarquia visual clara, sem polimento nos detalhes. Os baloes de mensagem sao verdes solidos sem sofisticacao, a lista de conversas nao tem destaque visual adequado, e o painel direito esta desorganizado.

### Problema 2: Fotos de contato nao persistem
O hook `useContactPhotos` faz requisicoes a Evolution API toda vez e nao salva os resultados. Se a API falha ou demora, os avatares ficam vazios.

---

## Solucao

### 1. Criar tabela `contact_photos` no banco de dados
Nova tabela para persistir as fotos de perfil dos contatos:

```sql
CREATE TABLE public.contact_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  remote_jid text NOT NULL,
  photo_url text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, remote_jid)
);
ALTER TABLE public.contact_photos ENABLE ROW LEVEL SECURITY;
-- RLS: usuario so ve/edita suas proprias fotos
CREATE POLICY "Users manage own contact photos" ON public.contact_photos
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 2. Refatorar `useContactPhotos` hook
- Primeiro carregar fotos do banco de dados (instantaneo)
- Em background, fazer fetch da Evolution API para atualizar
- Ao receber fotos novas da API, salvar/atualizar no banco via upsert
- Contatos que ja tiveram foto carregada mantem a imagem mesmo se a API falhar

### 3. Redesign completo do `ConversationList`
- Header mais sofisticado com titulo maior e botao de sync mais discreto
- Campo de busca com visual mais polido (rounded-full, icone integrado)
- Items da lista com hover suave, indicador de unread como badge numerico (nao ponto)
- Separacao visual mais clara entre item selecionado e os demais
- Preview de mensagem com 2 linhas e tipografia mais refinada
- Timestamp com formatacao mais elegante

### 4. Redesign do `ChatPanel`
- Header do chat mais robusto com status online/offline visual
- Baloes de mensagem com gradientes sutis em vez de cores solidas
- Outbound: gradiente de primary com sombra suave
- Inbound: background card com borda sutil
- Separadores de data mais discretos e elegantes
- Area de input redesenhada com visual mais moderno (borda sutil, sombra interna)
- Botoes de acao (bot, quick reply, send) com visual mais coeso
- Tela vazia (sem conversa selecionada) com ilustracao mais atraente

### 5. Redesign do `RightPanel`
- Avatar do contato maior com ring decorativo
- Secoes com cards separados em vez de separadores simples
- Labels com visual mais polido
- Quick replies com cards mais distintos
- Fluxo ativo com card destacado

### 6. Redesign do `ContactAvatar`
- Ring/borda sutil ao redor do avatar
- Fallback com gradiente de cores baseado no nome (em vez de bg-muted cinza)
- Transicao suave ao carregar imagem

---

### Arquivos a editar
- **Nova migration SQL**: tabela `contact_photos`
- `src/hooks/useContactPhoto.ts`: logica de cache persistente
- `src/components/conversations/ConversationList.tsx`: redesign completo
- `src/components/conversations/ChatPanel.tsx`: redesign completo
- `src/components/conversations/RightPanel.tsx`: redesign completo
- `src/components/conversations/ContactAvatar.tsx`: visual melhorado
- `src/pages/Conversations.tsx`: ajustes de layout se necessario

