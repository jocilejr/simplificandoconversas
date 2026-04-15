

## Problema

Os cards estão com elementos desproporcionais: o preview WhatsApp tem fontes e espaçamentos no tamanho original (14px, padding 18px, etc.) dentro de um card pequeno. A parte esquerda está desorganizada, sem hierarquia visual. As bordas e sombras são fracas, sem acabamento profissional.

## Correção

### 1. WhatsAppPreview — modo compact proporcional
**Arquivo:** `src/components/grupos/WhatsAppPreview.tsx`

- Quando `compact=true`, aplicar `transform: scale(0.72)` + `transform-origin: top left` no container do chat, e compensar a altura com um wrapper de tamanho fixo. Isso reduz proporcionalmente todos os elementos (fontes, ícones, padding) sem alterar cada valor individual.
- Remover o header "Preview do Grupo" e o footer "Digite uma mensagem" no modo compact (já feito).
- Ajustar o wrapper para `overflow: hidden` e altura fixa relativa ao card.

### 2. ScheduleCard — redesign robusto
**Arquivo:** `src/components/grupos/SchedulerDebugPanel.tsx`

**Card exterior:**
- Borda dupla sutil: `border border-border/40` + `ring-1 ring-white/5` no card atual
- Card atual: `bg-card shadow-2xl shadow-black/20 border-primary/30`
- Cards laterais: `bg-card/50 border-border/15`
- `rounded-2xl` em vez de `rounded-xl`

**Lado esquerdo (info) — reorganizar:**
- Header compacto: horário grande (`text-lg font-bold`) + data pequena + badge de status, tudo numa linha limpa
- Abaixo: badges de tipo + recorrência numa linha horizontal
- Separador sutil `border-border/10`
- Seção de detalhes com ícones inline: campanha, grupos, contadores de envio
- Diagnóstico no rodapé do lado esquerdo com fundo `bg-destructive/5` quando há erro
- Usar `text-[10px]` para labels e `text-xs` para valores — tudo menor e mais denso
- Padding interno reduzido: `px-2.5 py-2`

**Lado direito (preview):**
- Ocupa 55% do card
- Wrapper com `overflow: hidden`, sem scrollbar visível
- WhatsApp preview escalado via CSS `transform: scale(0.72)` para ficar proporcional
- Borda interna sutil `border-l border-border/10`

**Altura do stage:** Reduzir de `320px` para `280px` para ficar mais compacto e proporcional.

### 3. Transições
- Manter `transition-all duration-500 ease-out` nos cards
- Card ativo: `scale-100 opacity-100`
- Cards laterais: `scale-[0.93] opacity-45 blur-[1.5px]`

### Resultado
- Preview proporcional ao card (texto ~10px visual, não 14px)
- Lado esquerdo organizado com hierarquia clara
- Cards com acabamento robusto (bordas, sombras, radius)
- Sem scrollbar no preview
- Transições suaves entre cards

