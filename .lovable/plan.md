

## Problema

O `scanUserFiles` só varre arquivos na raiz (`/media-files/{userId}/`) e na pasta `tmp/`. A pasta `boletos/` é ignorada, então os PDFs de boleto nunca aparecem no gerenciador.

Além disso, boletos têm regra de retenção diferente: só devem ser deletados após **30 dias** (não 24h como os temporários comuns).

## Solução

### 1. Backend: `deploy/backend/src/routes/media-manager.ts`

**Escanear a pasta `boletos/`** adicionando um bloco similar ao de `tmp/`:

```typescript
const boletosDir = path.join(userDir, "boletos");
try {
  await fs.access(boletosDir);
  const entries = await fs.readdir(boletosDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = path.join(boletosDir, entry.name);
      const stat = await fs.stat(filePath);
      const mime = getMime(entry.name);
      files.push({
        name: entry.name,
        relativePath: `boletos/${entry.name}`,
        mime, category: getCategory(mime),
        size: stat.size, sizeFormatted: formatSize(stat.size),
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
        isTmpFolder: false,
        url: `/media/${userId}/boletos/${entry.name}`,
      });
    }
  }
} catch { /* boletos dir doesn't exist */ }
```

**Marcar boletos como "in use"** no `computeInUseSet`: verificar a tabela `transactions` onde `metadata->>'boleto_file'` referencia o arquivo.

**Regra de cleanup diferenciada**: No endpoint `/cleanup`, boletos usam cutoff de **30 dias** em vez de 24h:

```typescript
const isBoleto = f.relativePath.startsWith("boletos/");
const cutoff = isBoleto
  ? Date.now() - 30 * 24 * 60 * 60 * 1000   // 30 dias
  : Date.now() - 24 * 60 * 60 * 1000;        // 24h
```

### 2. Frontend: `src/components/settings/MediaManagerSection.tsx`

Adicionar filtro de categoria "Boleto" (já coberto pelo filtro "PDF" existente, mas podemos adicionar um badge visual "Boleto" para arquivos da pasta `boletos/`).

### Arquivos alterados
- `deploy/backend/src/routes/media-manager.ts` — scan de `boletos/`, inUse via transactions, cleanup 30d
- `src/components/settings/MediaManagerSection.tsx` — badge visual para boletos

