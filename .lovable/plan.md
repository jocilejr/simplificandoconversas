

## Fix: Labels desalinhados — StepNode.tsx (componente correto)

### Causa raiz

Todas as 6 tentativas anteriores editaram `GroupNode.tsx`. O screenshot mostra um **StepNode** ("Aguardar Clique" autônomo com header, body e timeout indicator) — componente `StepNode.tsx`.

O desalinhamento vem da diferença entre como handles e labels calculam sua posição vertical:

- **Handles**: `top: "35%"` + CSS `transform: translate(50%, -50%)` → centrado em Y=35%
- **Labels**: `top: "calc(35% - 6px)"` sem transform → topo do texto a 35%-6px, NÃO centrado

A aproximação de -6px não funciona porque depende da altura do texto e do handle serem constantes.

### Solução

Corrigir os spans de label no StepNode para usar o MESMO sistema de posicionamento dos handles: `top` percentual + `translateY(-50%)` para centralizar.

**`src/components/chatbot/StepNode.tsx`** — linhas 203-208 e 217-222:

```tsx
// Label "Respondeu ✓" (linha 203-208)
<span
  className="absolute text-[9px] font-medium text-muted-foreground pointer-events-none"
  style={{ right: -68, top: "35%", transform: "translateY(-50%)" }}
>
  Respondeu ✓
</span>

// Label timeout (linhas 217-222)
<span
  className="absolute text-[9px] font-medium pointer-events-none"
  style={{ right: -90, top: "70%", transform: "translateY(-50%)", color: "#f97316" }}
>
  {timeoutLabel} ⏱
</span>
```

### Por que funciona

Handles e labels agora usam a mesma fórmula: `top: X%` + `translateY(-50%)`. Ambos são `position: absolute` relativo ao mesmo `div.relative` (o container raiz do StepNode). O centro vertical dos dois elementos coincide exatamente.

### Arquivos alterados
- `src/components/chatbot/StepNode.tsx` (2 spans corrigidos)

