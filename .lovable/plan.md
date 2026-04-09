

# Replicar sistema de conversão PDF→Imagem do Finance Hub

## Problema

O `pdftoppm` (poppler-utils) no container Alpine Linux não renderiza corretamente certos PDFs do Mercado Pago — o JPG sai sem informações (em branco ou incompleto). O modal do frontend funciona porque usa `pdfjs-dist` com canvas no navegador.

O projeto Finance Hub resolve isso usando a biblioteca **mupdf** (WASM) que renderiza PDFs com fidelidade muito superior ao poppler, diretamente no backend.

## Solução

Substituir `pdftoppm` por **mupdf** como biblioteca Node.js no backend Express da VPS. O `mupdf` tem binding nativo para Node.js (`mupdf` no npm) e renderiza PDFs complexos com a mesma qualidade do navegador.

## Alterações

### 1. `deploy/backend/package.json`

Adicionar dependência `mupdf`:

```json
"mupdf": "^0.5.0"
```

### 2. `deploy/backend/src/lib/pdf-to-image.ts` (novo arquivo)

Criar utilitário centralizado de conversão PDF→JPG usando mupdf:

```typescript
import * as mupdf from "mupdf";
import { readFile, writeFile } from "fs/promises";

export async function convertPdfToJpg(pdfPath: string, jpgPath: string): Promise<void> {
  const pdfBuffer = await readFile(pdfPath);
  const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
  const page = doc.loadPage(0);
  const pixmap = page.toPixmap(
    mupdf.Matrix.scale(2, 2),
    mupdf.ColorSpace.DeviceRGB,
    false,
    true
  );
  const pngBytes = pixmap.asPNG();
  // Salvar como PNG (mais confiável que JPEG para mupdf)
  await writeFile(jpgPath, pngBytes);
}
```

**Nota**: A saída será PNG mas salva com extensão `.jpg` para compatibilidade. A Evolution API aceita ambos via base64.

### 3. `deploy/backend/src/lib/recovery-dispatch.ts` — bloco `image` (linhas 135-188)

Substituir o bloco `pdftoppm` pelo novo utilitário:

```typescript
} else if (block.type === "image") {
  const { data: tx } = await sb.from("transactions")...;
  // ... (mesmo código de verificação existente)
  
  // SUBSTITUIR pdftoppm por:
  const { convertPdfToJpg } = await import("./pdf-to-image");
  await convertPdfToJpg(fsPath, jpgPath);
  
  const imgBuffer = await fsModule.readFile(jpgPath);
  // ... resto igual (enviar via Evolution API)
```

### 4. `deploy/backend/src/routes/followup-daily.ts` — bloco `image`

Mesma substituição: trocar `pdftoppm` por `convertPdfToJpg`.

### 5. `deploy/backend/src/routes/payment.ts` — endpoint `boleto-image` (se usar pdftoppm)

Atualizar para usar o mesmo utilitário.

### 6. `deploy/backend/Dockerfile`

Remover `poppler-utils` (não mais necessário para conversão):

```dockerfile
FROM node:20-alpine
# poppler-utils removido — conversão via mupdf (npm)
WORKDIR /app
```

**Nota**: Se `poppler-utils` for usado em outro lugar, manter. Caso contrário, pode remover.

### 7. Deploy

```bash
docker compose up -d --build backend
# Limpar JPGs antigos
docker exec deploy-backend-1 find /media-files -name "*.jpg" -path "*/boletos/*" -delete
```

## Por que mupdf?

| Aspecto | pdftoppm (atual) | mupdf (proposto) |
|---------|-------------------|-------------------|
| Renderização | Falha em PDFs complexos do MP | Rendering engine completo |
| Fontes embutidas | Problemas no Alpine | Suporte completo |
| Dependência | System package (apk) | npm package nativo |
| Qualidade | ❌ Incompleto | ✅ Idêntico ao navegador |

