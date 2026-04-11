

## Plano: Reformular LockedOfferCard — blur na imagem + botão desbloquear

### Alterações em `src/components/membros/LockedOfferCard.tsx`

Substituir o card atual (button com rodapé, badge "Exclusivo", botão "Conhecer") por um card que replica a estrutura do `renderProductCard` (h-[120px]), com estas diferenças:

**Com imagem:**
- Imagem com `filter: blur(3px)` e `scale(1.05)` (para cobrir bordas do blur)
- Overlay escuro `bg-black/40`
- Badge "Bloqueado" com ícone Lock (no lugar de "Novo/Liberado")
- Título do produto visível (sem blur) sobre a imagem
- Botão "Desbloquear" compacto (`text-xs`, `px-3 py-1.5`, `rounded-full`) posicionado no canto inferior direito do card, com cor `themeColor`

**Sem imagem:**
- Background com gradiente suave do `themeColor`
- Ícone Lock grande com opacidade baixa como decoração
- Badge "Bloqueado" + título visível
- Mesmo botão "Desbloquear" no canto inferior direito

**Remover:**
- Rodapé com description + "Conhecer"
- Import de `Sparkles`
- `getContextLabel` e `CONTEXTUAL_LABELS` (causa do bug de texto aleatório)

O `onClick` do botão "Desbloquear" chama `handleOpen()` (abre o dialog de chat IA). O Dialog e PaymentFlow permanecem inalterados.

### Resultado
- Card de oferta fica visualmente uniforme com os cards de produto
- Blur apenas na imagem, título legível
- Botão "Desbloquear" claro e integrado dentro do card

