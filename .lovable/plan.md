

## Fix: Labels desalinhados com handles — abordagem definitiva

### Causa raiz

Os handles e labels usam `calc(100% - Xpx)` com `position: absolute`, mas a resolução de `100%` difere entre eles. O React Flow aplica `transform` no wrapper externo do nó, criando um containing block diferente para os handles (que têm estilos `!important`). Resultado: handles e labels ficam posicionados por referências verticais distintas, impossibilitando alinhamento via `top: calc(100% - X)`.

Prova via inspeção no browser:
- Handle output-0 computou `top: 10px`, handle output-1 computou `top: 60px + translateY(50px)`
- Labels computaram `top: 100px` e `top: 120px`
- Os valores diferem completamente, confirmando containing blocks diferentes

### Solução

Mover os handles de saída para DENTRO do footer, como filhos de divs com `position: relative`. Cada div-row contém o label (flow normal) e o Handle (absoluto relativo à row). Assim, label e handle compartilham o MESMO container e ficam naturalmente alinhados.

**`src/components/chatbot/GroupNode.tsx`** — substituir o footer vazio + labels/handles externos por:

```tsx
{hasFinalizerStep && (
  <div className="border-t border-border/40">
    <div className="relative flex items-center justify-end pr-5 h-6">
      <span className="text-[10px] font-medium text-emerald-500">Continuou ✓</span>
      <Handle
        type="source"
        position={Position.Right}
        id="output-0"
        className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full group-handle-output-0"
        style={{ background: accentColor }}
      />
    </div>
    <div className="relative flex items-center justify-end pr-5 h-6">
      <span className="text-[10px] font-medium text-orange-500">{timeoutLabel} ⏱</span>
      <Handle
        type="source"
        position={Position.Right}
        id="output-1"
        className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full group-handle-output-1"
        style={{ background: "#f97316" }}
      />
    </div>
  </div>
)}
```

E remover os divs de label e handles que estavam fora do card (linhas 483-504).

**`src/index.css`** — atualizar as classes dos handles para posicionar relativo à row:

```css
.group-handle-output-0,
.group-handle-output-1 {
  top: 50% !important;
  right: -6px !important;
  transform: translateY(-50%) !important;
}
```

### Por que funciona

Cada Handle agora é `position: absolute` dentro de uma div `position: relative` com altura fixa de 24px. O label é texto no flow normal, centralizado via flexbox. O handle é posicionado a `top: 50%` da mesma div, garantindo alinhamento perfeito. O React Flow calculará as coordenadas da edge a partir da posição real do handle na tela.

### Arquivos alterados
- `src/components/chatbot/GroupNode.tsx`
- `src/index.css`

