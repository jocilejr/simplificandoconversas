

## Melhorar layout do GroupNode com saídas de timeout

O problema: os labels das saídas ("Continuou ✓" e "Se não clicou ⏱") usam posicionamento absoluto com `right: -68px` / `right: -90px`, ficando cortados ou invisíveis. O grupo também é estreito demais (280px) para acomodar bem os handles e labels.

### Mudanças em `src/components/chatbot/GroupNode.tsx`

1. **Aumentar largura do grupo** de `w-[280px]` para `w-[320px]` quando `hasTimeoutOutputs`, dando mais espaço visual.

2. **Adicionar rodapé interno** com os labels de saída dentro do card (não mais fora com posição absoluta):
   - Quando `hasTimeoutOutputs`, renderizar um rodapé com duas linhas:
     - Linha verde: `● Continuou ✓` alinhado à direita
     - Linha laranja: `● Se não respondeu/clicou ⏱` alinhado à direita
   - Cada linha terá um pequeno círculo colorido que corresponde visualmente ao handle

3. **Remover os `<span>` externos** com posição absoluta (`right: -68`, `right: -90`) que causam o clipping.

4. **Ajustar posição dos handles** para alinhar com o rodapé interno — mover para posições mais baixas no nó (ex: últimos 25% do card) para que fiquem ao lado das labels internas.

### Resultado
- Labels de saída visíveis dentro do card, nunca cortados
- Handles alinhados verticalmente com as labels internas
- Design mais limpo e consistente

### Arquivo alterado
- `src/components/chatbot/GroupNode.tsx`

