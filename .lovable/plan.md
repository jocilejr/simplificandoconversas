

## Plano: Corrigir importação para usar a seção `media` top-level do backup

### Causa raiz confirmada

Analisei o código fonte original do `whats-grupos` (`src/lib/backup.ts`). O formato do backup é:

```text
{
  "version": 1,
  "source_url": "https://xxx.supabase.co",
  "data": {
    "campaigns": [...],
    "scheduled_messages": [...]
  },
  "media": {
    "userId/1234-foto.png": "data:image/png;base64,iVBOR...",
    "userId/5678-video.mp4": "data:video/mp4;base64,AAAA..."
  }
}
```

As mídias ficam no dicionário **top-level `media`** (não dentro das mensagens). As mensagens referenciam mídias via URLs completas do Supabase Storage, como:
`https://xxx.supabase.co/storage/v1/object/public/media/userId/1234-foto.png`

O parser atual ignora completamente a seção `media` top-level e procura `data:` URIs dentro dos campos das mensagens — que não existem. Por isso `mediaCount = 0`.

### Solução

Reescrever o parser para extrair a seção `media` top-level e o `source_url`, e adaptar o fluxo de upload para fazer o remapeamento de URLs correto.

### Mudanças

| Arquivo | Ação |
|---|---|
| `src/lib/backupParser.ts` | Adicionar extração da seção `media` top-level (dicionário `path → dataUri`) e do `source_url`. Mudar `BackupSummary` para incluir `topLevelMedia: Record<string, string>` e `sourceUrl: string`. Manter `mediaEntries` como fallback mas priorizar `topLevelMedia`. Contar mídias = `Object.keys(topLevelMedia).length` |
| `src/components/grupos/GroupImportDialog.tsx` | Reescrever Step 2 para iterar sobre `summary.topLevelMedia` (chave=path, valor=dataUri), converter cada um via `dataUriToFile`, fazer upload, e montar um mapa de `oldUrl → newUrl` (onde `oldUrl = sourceUrl + /storage/v1/object/public/media/ + path`). No Step 3, enviar esse mapa para o backend fazer `replaceUrls` no conteúdo das mensagens |

### Lógica detalhada

**Parser (`backupParser.ts`)**:
1. Após extrair `campaigns` e `scheduled_messages`, procurar `"media"\s*:\s*{` no texto (fora da seção `data`)
2. Usar `findMatchingBracket` para extrair o objeto JSON
3. Parsear como `Record<string, string>` — cada chave é um path de storage, cada valor é um data URI
4. Extrair `source_url` do backup com regex `"source_url"\s*:\s*"([^"]+)"`
5. `mediaKeys = Object.keys(topLevelMedia)`

**Upload (`GroupImportDialog.tsx`)**:
1. Para cada `[path, dataUri]` em `topLevelMedia`: extrair nome do arquivo de `path`, converter com `dataUriToFile`, upload via FormData
2. Montar mapa: `oldUrl` (`${sourceUrl}/storage/v1/object/public/media/${path}`) → `newUrl` (retornado pelo backend)
3. Enviar mapa de remapeamento para o backend atualizar as URLs nas mensagens

### Resultado esperado
As mídias do backup serão corretamente detectadas (contagem correta na UI), enviadas ao servidor, e as referências nas mensagens atualizadas com as novas URLs.

