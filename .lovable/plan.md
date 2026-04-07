

# Fix: Envio de JPG do boleto via Evolution API

## Problema raiz

O `recovery-dispatch.ts` monta a URL da imagem usando `APP_PUBLIC_URL` (APP_DOMAIN), mas a rota `/api/payment/boleto-image/` só existe no API_DOMAIN no Nginx. A Evolution API recebe o HTML do SPA em vez da imagem JPG.

## Solução

Alterar o `recovery-dispatch.ts` para converter o PDF→JPG **localmente** no backend e enviar o base64 direto para a Evolution, eliminando a dependência de URLs externas.

### Alteração em `deploy/backend/src/lib/recovery-dispatch.ts`

No bloco `image` (linhas 125-161), substituir a lógica de URL por:

1. Ler o caminho do PDF do metadata (`boleto_file`)
2. Converter para path no filesystem (`/media-files/...`)
3. Verificar se já existe o JPG em cache no disco
4. Se não, rodar `pdftoppm -jpeg -singlefile -r 200` (mesma lógica do endpoint)
5. Ler o JPG e converter para base64
6. Enviar para Evolution como `media: "data:image/jpeg;base64,..."` em vez de URL

```typescript
// Bloco image — conversão local + base64
const boletoFile = meta.boleto_file as string;
const fsPath = boletoFile.replace("/media/", "/media-files/");
const jpgPath = fsPath.replace(/\.pdf$/i, ".jpg");

// Check cache or convert
const fsModule = await import("fs/promises");
try {
  await fsModule.access(jpgPath);
} catch {
  // Convert
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execPromise = promisify(exec);
  const prefix = jpgPath.replace(/\.jpg$/i, "");
  await execPromise(`pdftoppm -jpeg -singlefile -r 200 "${fsPath}" "${prefix}"`);
}

const buffer = await fsModule.readFile(jpgPath);
const base64 = buffer.toString("base64");
const mediaData = `data:image/jpeg;base64,${base64}`;

// Send via Evolution
await fetch(`${evoBaseUrl}/message/sendMedia/${instanceName}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: evoApiKey },
  body: JSON.stringify({
    number: phone,
    mediatype: "image",
    media: mediaData,
    caption: "",
  }),
});
```

Mesma correção para o bloco `pdf` (linhas 82-124): trocar a URL `APP_PUBLIC_URL` por leitura local do arquivo + base64.

### Blocos afetados

| Bloco | Antes | Depois |
|-------|-------|--------|
| `pdf` | URL `APP_PUBLIC_URL/api/payment/boleto-pdf/` | Leitura local do PDF + base64 `data:application/pdf;base64,...` |
| `image` | URL `APP_PUBLIC_URL/api/payment/boleto-image/` | Conversão local pdftoppm + base64 `data:image/jpeg;base64,...` |

### Arquivo alterado

`deploy/backend/src/lib/recovery-dispatch.ts` — blocos pdf e image

### Após deploy

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

