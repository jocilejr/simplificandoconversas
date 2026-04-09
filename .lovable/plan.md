

# Fix: JPG do boleto não corresponde ao PDF original

## Problema

O sistema cacheia o JPG convertido no disco. Se um JPG antigo/corrompido já existe para aquele boleto, ele é reutilizado sem nunca reconverter do PDF atual. A lógica é:

1. Tenta `access(jpgPath)` — se existe, usa direto
2. Só converte do PDF se o JPG **não** existe

Se o JPG foi criado a partir de um PDF antigo, ou se houve erro na primeira conversão, o JPG errado fica sendo enviado para sempre.

## Solução

**Sempre reconverter o PDF para JPG** antes de enviar, removendo o cache. Isso garante que o JPG sempre reflete o PDF atual. O custo de `pdftoppm` é desprezível (< 1s por arquivo).

## Alterações

### 1. `deploy/backend/src/routes/followup-daily.ts` (linhas 344-359)

No bloco `image`, remover o check de cache (`access(jpgPath)`). Sempre converter:

```typescript
} else if (block.type === "image") {
  const boletoFile = meta.boleto_file as string | undefined;
  if (boletoFile) {
    const fsModule = await import("fs/promises");
    const fsPath = boletoFile.replace("/media/", "/media-files/");
    const jpgPath = fsPath.replace(/\.pdf$/i, ".jpg");
    try {
      // Verificar se o PDF existe
      await fsModule.access(fsPath);
      // Sempre reconverter para garantir que o JPG corresponde ao PDF
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execPromise = promisify(exec);
      const prefix = jpgPath.replace(/\.jpg$/i, "");
      await execPromise(`pdftoppm -jpeg -singlefile -r 200 "${fsPath}" "${prefix}"`);
      // ... resto igual (ler, enviar)
```

### 2. `deploy/backend/src/lib/recovery-dispatch.ts` (linhas 154-173)

Mesma mudança: remover o cache hit. Sempre converter do PDF:

```typescript
// Verificar se PDF existe
try {
  await fsModule.access(fsPath);
} catch {
  console.log(`[recovery-dispatch] PDF not found: ${fsPath}`);
  return;
}
// Sempre reconverter PDF → JPG
const { exec } = await import("child_process");
const { promisify } = await import("util");
const execPromise = promisify(exec);
const prefix = jpgPath.replace(/\.jpg$/i, "");
await execPromise(`pdftoppm -jpeg -singlefile -r 200 "${fsPath}" "${prefix}"`);
```

### 3. Limpeza imediata dos JPGs antigos (opcional mas recomendado)

Após deploy, rodar na VPS para limpar todos os JPGs cacheados:

```bash
docker exec deploy-backend-1 find /media-files -name "*.jpg" -path "*/boletos/*" -delete
```

### 4. Deploy

```bash
docker compose up -d --build backend
```

