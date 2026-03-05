

## Fix: Labels desalinhados com os handles

### Problema

Os handles estão posicionados com CSS absoluto (`top: calc(100% - 42px)` e `top: calc(100% - 18px)`), mas as labels "Continuou ✓" e "Se não clicou ⏱" estão dentro de um div com `space-y-3` e padding genérico. O espaçamento CSS não corresponde às coordenadas reais dos handles — especialmente o segundo label fica visualmente acima do handle laranja.

### Solução

Trocar o footer por um container com altura fixa e posicionamento relativo. Cada label será posicionada com `bottom` absoluto para corresponder exatamente aos handles:

- Handle `output-0`: `top: calc(100% - 42px)` → label "Continuou" a `bottom: 42px`
- Handle `output-1`: `top: calc(100% - 18px)` → label "Se não clicou" a `bottom: 18px`

**`src/components/chatbot/GroupNode.tsx`** (linhas 470-478):

```tsx
{hasFinalizerStep && (
  <div className="relative border-t border-border/40" style={{ height: '52px' }}>
    <div className="absolute right-5 flex items-center" style={{ bottom: '32px' }}>
      <span className="text-[10px] font-medium text-emerald-500">Continuou ✓</span>
    </div>
    <div className="absolute right-5 flex items-center" style={{ bottom: '8px' }}>
      <span className="text-[10px] font-medium text-orange-500">{timeoutLabel} ⏱</span>
    </div>
  </div>
)}
```

Os valores `bottom` são ajustados para compensar o offset do footer dentro do nó (o footer não começa em `bottom: 0` do nó, pois há o border-radius e padding do card).

### Arquivos alterados
- `src/components/chatbot/GroupNode.tsx`

