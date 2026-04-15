
Objetivo: travar a box central do SchedulerDebugPanel em largura fixa, independente da quantidade de programações, e fazer o carrossel rolar dentro de uma “janela” fixa mostrando anterior/próximo sem empurrar o layout.

1. Causa raiz confirmada
- O painel raiz já tem `overflow-hidden`, mas o trilho interno (`div` com `display:flex`) continua participando do cálculo de largura do layout.
- Falta uma viewport interna explicitamente fixa e centralizada.
- Também falta `min-w-0` nos containers pais imediatos do dashboard, então o conteúdo ainda consegue forçar expansão horizontal.

2. Correção no SchedulerDebugPanel
- Criar uma viewport fixa para o carrossel, separada do Card raiz.
- Estrutura:
  - `Card`
    - header
    - `div` wrapper full width com overflow hidden
      - `div` viewport fixa centralizada (`w-full max-w-[980px] mx-auto`)
        - setas posicionadas relativas a essa viewport
        - trilho scrollável interno
- Aplicar largura explícita fixa/limitada na viewport para desktop e responsiva no mobile:
  - desktop: `max-w-[980px]`
  - tablet/mobile: `w-full`
- Adicionar `min-w-0 w-full overflow-hidden` em todos os wrappers internos dessa área.
- Mover o `px-4` do trilho para um wrapper interno ou trocar por `scroll-padding`, para o padding não aumentar a largura efetiva.
- Garantir que o trilho use só rolagem interna:
  - `w-full min-w-0 overflow-x-auto overflow-y-hidden`
- Garantir “peek” lateral dos cards:
  - viewport fixa + card de 310px + gap controlado + centralização por `scrollLeft`.

3. Correção no GroupDashboardTab
- Adicionar contenção horizontal no container onde o painel é renderizado.
- Ajustar wrappers principais para `min-w-0` onde necessário, evitando que o item do meio force a grid/page a crescer.

4. Correção no layout pai
- Em `AppLayout`, aplicar `min-w-0` no container principal ao lado da sidebar e no `main`, porque flex children sem isso podem estourar horizontalmente mesmo com overflow hidden.

5. Resultado esperado
- A box do meio permanece com largura visual fixa.
- A quantidade de programações não altera o tamanho do painel.
- O usuário vê a programação atual e parte da anterior/próxima.
- Toda navegação acontece só dentro do carrossel, sem empurrar os boxes de cima/baixo nem sair da tela.

6. Arquivos a ajustar
- `src/components/grupos/SchedulerDebugPanel.tsx`
- `src/components/grupos/GroupDashboardTab.tsx`
- `src/components/AppLayout.tsx`

Detalhe técnico
```text
Hoje:
Card -> trilho flex largo demais -> largura vaza para o layout

Depois:
Card (w-full, overflow-hidden)
  -> wrapper (w-full, overflow-hidden)
    -> viewport fixa (w-full max-w-[980px] mx-auto overflow-hidden)
      -> trilho scrollável interno
        -> cards 310px
```
