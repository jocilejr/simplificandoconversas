

## Refinar Layout Público da Área de Membros + Corrigir IA

Dois problemas identificados:

### Problema 1: IA não funciona
As funções `member-ai-context` e `member-offer-pitch` são chamadas via `supabase.functions.invoke()`, que vai para o Lovable Cloud. Como você usa apenas a VPS, essas edge functions não funcionam no seu ambiente. A solução é criar rotas equivalentes no backend da VPS.

### Problema 2: Layout genérico
Os cards de produto, a saudação da IA, ofertas e o layout geral precisam de refinamento visual para parecer profissional.

---

### Alterações

**1. Backend VPS — Nova rota `/api/member-ai-context` (deploy/backend/src/routes/member-access.ts)**

Mover a lógica da edge function `member-ai-context` para uma rota POST no backend da VPS:
- Busca a `openai_api_key` na tabela `openai_settings`
- Busca `ai_persona_prompt` na tabela `member_area_settings`
- Gera a saudação personalizada via OpenAI
- Retorna `{ greeting, tip }`

**2. Backend VPS — Nova rota `/api/member-offer-pitch` (deploy/backend/src/routes/member-access.ts)**

Mover a lógica da edge function `member-offer-pitch` para uma rota POST no backend da VPS:
- Busca API key e prompts configurados
- Gera mensagens de pitch de oferta via OpenAI
- Retorna `{ messages, productImageUrl }`

**3. Frontend — `src/pages/MemberAccess.tsx`**

- Substituir `supabase.functions.invoke("member-ai-context")` por `fetch("/api/member-ai-context", { method: "POST", body })` 
- Substituir `supabase.functions.invoke("member-offer-pitch")` por `fetch("/api/member-offer-pitch", { method: "POST", body })` no `LockedOfferCard`

**4. Frontend — `src/components/membros/LockedOfferCard.tsx`**

- Substituir chamada de edge function por fetch ao VPS backend

**5. Refinamento Visual — `src/pages/MemberAccess.tsx`**

Layout público refinado:
- **Header**: Barra superior com logo + nome do membro (se disponível), em vez de ir direto ao conteúdo
- **Saudação IA**: Estilizar o card de chat com tipografia mais elegante, avatar maior, fundo com gradiente sutil e bordas refinadas
- **Cards de Produto**: 
  - Bordas mais suaves, sombras com profundidade (`shadow-lg` em hover)
  - Tipografia refinada — título em `font-bold` sem uppercase forçado
  - Barra de progresso mais elegante com label contextual
  - Transição de hover mais fluida
  - Ícone do tipo de conteúdo (PDF/Vídeo) mais discreto
- **Espaçamento**: Aumentar gap entre seções para respirar (space-y-4 → space-y-5)
- **Footer**: Mais discreto e elegante
- **Oração do dia**: Card com visual mais premium (borda lateral colorida em vez de emoji grande)

**6. Refinamento Visual — `src/components/membros/LockedOfferCard.tsx`**

- Card externo: visual mais limpo, sem uppercase forçado, badge "EXCLUSIVO" mais sutil
- Dialog interno: Manter estilo WhatsApp mas refinar tipografia e espaçamento

**7. Refinamento Visual — `src/components/membros/DailyVerse.tsx`**

- Remover emoji e usar borda lateral com cor temática
- Tipografia serif mais elegante

**8. Refinamento Visual — `src/components/membros/BottomPageOffer.tsx`**

- Card com hover mais suave, tipografia refinada

