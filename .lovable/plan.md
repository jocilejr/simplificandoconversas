

# Fix: Scroll e botão "Ver mais" na seleção de transação PIX

## Problema
O conteúdo do step `select-tx` ultrapassa a altura do dialog. O container pai (linha 379) não tem `overflow` nem altura máxima, então:
1. O botão "Ver mais" fica fora da área visível
2. Não há scroll no container geral do step

## Solução

### Arquivo: `src/components/entrega/DeliveryFlowDialog.tsx`

1. **Adicionar `overflow-y-auto` e `max-h` ao container de conteúdo** (linha 379) para que todo o conteúdo do step seja scrollável quando exceder a altura do dialog.

2. **Mover o botão "Ver mais" para DENTRO do `ScrollArea`** (após a lista de transações, dentro do `div.space-y-2`), para que fique acessível via scroll.

3. Alterar o container de conteúdo de:
```
<div className="px-6 py-5 min-h-[220px]">
```
para:
```
<div className="px-6 py-5 min-h-[220px] max-h-[calc(90vh-120px)] overflow-y-auto">
```

4. Remover o `max-h-[240px]` do `ScrollArea` interno (linha 501) pois o scroll agora é controlado pelo container pai — ou aumentar para `max-h-[400px]` para dar mais espaço às transações.

