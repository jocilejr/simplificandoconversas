

## Corrigir exibição de timeout nos steps dentro do GroupNode

O problema: quando `waitForClick` ou `waitForReply` estão acoplados dentro de um grupo, o step row renderiza como um pill simples sem mostrar o indicador de timeout (ex: "Timeout: 1min" com ícone de relógio). O nó standalone mostra isso corretamente.

### Mudança

**`src/components/chatbot/GroupNode.tsx`** — Nos blocos de renderização do `waitForClick` e no bloco default (que renderiza `waitForReply`), adicionar o indicador de timeout abaixo do conteúdo do step:

1. **waitForClick (linhas 149-177)**: Mudar de layout `flex` horizontal para `flex-col` vertical. Manter o pill com ícone de link + URL na primeira linha. Adicionar abaixo uma linha com `Clock` + texto "Timeout: Xmin/s/h" em laranja, visível apenas quando `clickTimeout > 0`.

2. **Bloco default (renderiza waitForReply e outros)**: No final do bloco, após o `renderPreview()`, adicionar o mesmo indicador de timeout quando `d.type === "waitForReply"` e `replyTimeout > 0`.

O indicador visual será idêntico ao do `StepNode` standalone:
```tsx
{hasTimeout && (
  <div className="flex items-center gap-1.5 px-1 mt-1">
    <Clock className="w-3 h-3 text-orange-500" />
    <span className="text-[10px] text-orange-500 font-medium">
      Timeout: {timeoutValue}{unitLabel}
    </span>
  </div>
)}
```

### Arquivos alterados
- `src/components/chatbot/GroupNode.tsx` — adicionar indicador de timeout nos step rows de waitForClick e waitForReply

