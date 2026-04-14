

## Problema

O `DialogContent` usa `display: grid` (classe base) com `w-full`, mas o conteúdo filho (Tabs, TabsList, cards) não está contido pela largura do grid. O `overflow-x-hidden` no DialogContent não resolve porque os filhos do grid podem expandir o container antes do overflow ser aplicado.

Na screenshot: só "Único" e "Diário" aparecem, as outras 3 abas saem da tela. Os textos dos cards também vazam.

## Correção: `src/components/grupos/GroupMessagesDialog.tsx`

Envolver todo o conteúdo do Tabs em um container com largura forçada e overflow controlado:

1. **DialogContent**: trocar `overflow-x-hidden` por uma abordagem mais agressiva — adicionar `w-full` explícito (já tem via base) e garantir que os filhos não expandam o grid.

2. **Envolver o `<Tabs>` inteiro** em um `<div className="w-full min-w-0 overflow-hidden">` — isso cria um boundary real de largura que o grid do Dialog respeita.

3. **TabsList**: adicionar `overflow-hidden` para que o grid de 5 colunas não expanda.

4. **TabsContent**: adicionar `w-full min-w-0 overflow-hidden` para conter os cards.

5. **Cada card de mensagem**: já tem `w-full min-w-0 overflow-hidden` — está correto, mas o container pai precisa do boundary.

### Código resultante (trecho chave):

```tsx
<DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
  <DialogHeader>...</DialogHeader>

  <div className="w-full min-w-0 overflow-hidden">
    <Tabs value={activeTab} onValueChange={...}>
      <TabsList className="w-full grid grid-cols-5 gap-0 overflow-hidden">
        ...
      </TabsList>

      {SCHEDULE_TABS.map(tab => {
        ...
        return (
          <TabsContent key={tab.value} value={tab.value} className="space-y-3 mt-4 w-full min-w-0 overflow-hidden">
            ...
          </TabsContent>
        );
      })}
    </Tabs>
  </div>
</DialogContent>
```

### Arquivo alterado
- `src/components/grupos/GroupMessagesDialog.tsx`

