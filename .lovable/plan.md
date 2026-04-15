

## Problema

O container do carrossel tem `height: 488px` fixo, mas o `overflow-hidden` no wrapper `relative` não está impedindo o conteúdo de expandir o `Card` pai horizontalmente. Os cards com `flex-shrink-0 w-[310px] min-w-[310px]` expandem o flex container, e o `Card` pai cresce junto.

## Correção

**Arquivo**: `src/components/grupos/SchedulerDebugPanel.tsx`

1. Adicionar `overflow-hidden` no `Card` raiz (linha 298) para conter o conteúdo horizontalmente
2. Adicionar `overflow-hidden` no `CardContent` 
3. Garantir que o div do carrossel (linha 341) tenha `max-width: 100%` ou `width: 100%` explícito para não ultrapassar o container pai

Mudança concreta:

| Linha | Antes | Depois |
|-------|-------|--------|
| 298 | `<Card className="border-border/50">` | `<Card className="border-border/50 overflow-hidden isolate">` |
| 341 | `<div className="relative overflow-hidden" style={{ contain: "layout paint", height: "488px" }}>` | Sem mudança (já correto) |
| 364 | `className="flex h-full items-start gap-4 px-4 py-4 scroll-smooth"` | Sem mudança |

A causa raiz é que o `Card` pai não tem `overflow-hidden`, então o conteúdo do flex container interno (todos os cards lado a lado) empurra a largura do Card para fora da tela.

