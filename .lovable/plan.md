

## Plano: Importar página pública completa do Finance Hub

### Escopo

Substituir a página pública atual (`MemberAccess.tsx`) — que é básica e usa o backend VPS — pela versão completa do Finance Hub (`AreaMembrosPublica.tsx`), que inclui: IA contextual, progresso de conteúdo, PDF viewer, ofertas com pitch AI, pagamentos (PIX/Boleto/Cartão), pixel tracking, session tracking e Daily Verse.

### Importante: Este projeto usa backend VPS

A página pública do Finance Hub acessa o Supabase diretamente (client-side). Neste projeto, a arquitetura é diferente: a página pública roda no domínio `membros.origemdavida.online` e usa o backend VPS via `member-access` route. Precisamos adaptar: a página buscará dados iniciais via VPS backend e, para funcionalidades interativas (sessão, progresso, ofertas), usará o Supabase client diretamente com RLS aberto para operações públicas.

---

### Parte 1 — Tabelas novas (migração SQL)

Criar as tabelas que existem no Finance Hub mas não neste projeto:

1. `member_content_progress` — progresso de PDF/vídeo por telefone+material
2. `member_pixel_frames` — frames de pixel pendentes para disparar na página
3. `member_offer_impressions` — impressões e cliques de ofertas por telefone
4. `daily_prayers` — orações do dia (100 registros, day_number 1-100)
5. `openai_settings` — armazena API key da OpenAI (workspace_id)
6. `product_knowledge_summaries` — resumos de conhecimento por produto
7. `manual_boleto_settings` — webhook URL para boleto manual

Criar as funções RPC:
- `increment_offer_impression(offer_id uuid)`
- `increment_offer_click(offer_id uuid)`

RLS: Todas com INSERT/UPDATE público para `member_content_progress`, `member_sessions`, `member_offer_impressions` (acesso público sem auth). SELECT restrito por workspace para tabelas admin.

### Parte 2 — Componentes do frontend (copiar e adaptar)

Criar/substituir estes arquivos:

1. **`src/pages/MemberAccess.tsx`** — Substituir completamente pelo conteúdo de `AreaMembrosPublica.tsx` do Finance Hub, adaptado para:
   - Buscar dados iniciais via `apiUrl("member-access/...")` (backend VPS) em vez de queries diretas ao Supabase
   - Usar Supabase client para funcionalidades interativas (sessão, progresso, ofertas)

2. **`src/components/membros/DailyVerse.tsx`** — Copiar do Finance Hub (já existe diretório `membros`)
3. **`src/components/membros/ProductContentViewer.tsx`** — Copiar (já existe)
4. **`src/components/membros/LockedOfferCard.tsx`** — Criar novo
5. **`src/components/membros/BottomPageOffer.tsx`** — Criar novo
6. **`src/components/membros/PhysicalProductShowcase.tsx`** — Criar novo
7. **`src/components/membros/FloatingOfferBar.tsx`** — Criar novo
8. **`src/components/membros/MaterialCard.tsx`** — Criar novo
9. **`src/components/membros/PdfViewer.tsx`** — Criar novo
10. **`src/components/membros/PaymentFlow.tsx`** — Criar novo

### Parte 3 — Bibliotecas compartilhadas

1. **`src/lib/pixelFiring.ts`** — Criar novo (utilitário de disparo de pixels Meta/TikTok/Google/Pinterest/Taboola)
2. **`src/hooks/useMemberSession.ts`** — Criar novo (heartbeat de sessão)

### Parte 4 — Asset

1. **`src/assets/meire-rosana.png`** — Copiar do Finance Hub (usado no chat bubble da IA)

### Parte 5 — Edge Functions (Lovable Cloud)

Portar as 4 edge functions necessárias:

1. **`member-ai-context`** — Gera greeting personalizado com OpenAI
2. **`member-offer-pitch`** — Gera pitch de venda em formato chat
3. **`member-purchase`** — Registra transação de compra pela área de membros
4. **`meta-conversions-api`** — Server-side pixel firing (Meta CAPI)

### Parte 6 — Backend VPS (adaptar endpoint)

Expandir `deploy/backend/src/routes/member-access.ts` para retornar dados adicionais que a nova página precisa:
- `offers` (lista de ofertas ativas)
- `customer` (nome do cliente)
- `settings.theme_color`
- `settings.ai_persona_prompt`

---

### Ordem de execução

1. Migrações SQL (tabelas + RPC + RLS)
2. Copiar asset `meire-rosana.png`
3. Criar `src/lib/pixelFiring.ts` e `src/hooks/useMemberSession.ts`
4. Criar os 8 componentes em `src/components/membros/`
5. Substituir `src/pages/MemberAccess.tsx`
6. Criar as 4 edge functions
7. Adaptar o endpoint do backend VPS

