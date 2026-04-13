

## Plano: Corrigir importação de mídias — estrutura do backup incompatível

### Causa raiz

O parser atual (`backupParser.ts`) assume que o backup tem uma seção **top-level** com formato:
```json
{ "media": { "caminho/arquivo.png": "data:image/png;base64,..." } }
```

Mas o backup real do "whats-grupos" **não tem essa seção**. A primeira ocorrência de `"media": {` que o parser encontra pertence a uma **mensagem individual** e contém metadados como `group_id`, `message_type`, `fileName`, `mediaUrl` — que são tratados erroneamente como paths de arquivo. Resultado: "Invalid data URI" para cada chave.

A mídia no backup está embutida **dentro de cada mensagem** (`content.mediaUrl` ou campo similar), provavelmente como data URI (base64) ou URL externa.

### Solução

Abandonar a abordagem de "seção media top-level" e extrair mídias **diretamente das mensagens agendadas** já parseadas.

### Mudanças

| Arquivo | Ação |
|---|---|
| `src/lib/backupParser.ts` | Reescrever `parseBackupSummary` para contar mídias a partir dos `scheduledMessages` (mensagens com `content.mediaUrl` começando com `data:`) em vez de `scanMediaKeys`. Remover `scanMediaKeys`, `extractKeysFromChunk` e `iterateMediaEntries` (não mais necessários). Adicionar nova função `extractMediaFromMessages` que itera sobre as mensagens e retorna `{ messageIndex, mediaUrl (data URI) }` |
| `src/components/grupos/GroupImportDialog.tsx` | Alterar etapa 2 para iterar sobre `summary.scheduledMessages` em vez de `iterateMediaEntries(file)`. Para cada mensagem com `content.mediaUrl` em base64: converter via `dataUriToFile`, fazer upload via FormData, e guardar o mapeamento `oldDataUri → newUrl`. Na etapa 3 (remap), enviar o mapeamento para o backend atualizar `content.mediaUrl` nas mensagens do banco |

### Lógica detalhada

1. **`parseBackupSummary`**: Após extrair `scheduledMessages`, contar quantas têm `content.mediaUrl` começando com `data:` — esse é o `mediaCount`. Não precisa mais do `scanMediaKeys`.

2. **Upload no diálogo**: 
   - Iterar `summary.scheduledMessages` 
   - Para cada msg com `content.mediaUrl` que começa com `data:`:
     - Usar `dataUriToFile(content.mediaUrl, fileName)` para converter
     - Upload via FormData para `/groups/import-media`
     - Guardar `{ messageIndex → newUrl }`
   - Mensagens com `mediaUrl` que é URL normal (http/https): ignorar, já está pronta

3. **Remap**: Enviar lista de `{ messageId, newMediaUrl }` para o backend atualizar `content->'mediaUrl'` no banco

### Resultado esperado
As mídias em base64 do backup serão corretamente extraídas das mensagens, enviadas para o servidor, e as referências atualizadas. Mídias que já são URLs externas serão preservadas sem alteração.

