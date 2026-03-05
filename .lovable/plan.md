

## Correção: Forçar mimetype PDF sempre no envio de arquivos

### Arquivo: `supabase/functions/execute-flow/index.ts` (linha 178-182)

Simplificar a lógica removendo a condicional de extensão. Sempre:
1. Forçar `mimetype: "application/pdf"`
2. Garantir que `fileName` termine com `.pdf` (append automático se necessário)

```typescript
// De:
const fileName = (stepData as any).fileName || "documento.pdf";
// ...
...(fileName.toLowerCase().endsWith(".pdf") ? { mimetype: "application/pdf" } : {})

// Para:
let fileName = (stepData as any).fileName || "documento.pdf";
if (!fileName.toLowerCase().endsWith(".pdf")) fileName += ".pdf";
// ...
mimetype: "application/pdf"  // sempre
```

Uma alteração de 2 linhas. Nenhum outro arquivo precisa mudar.

