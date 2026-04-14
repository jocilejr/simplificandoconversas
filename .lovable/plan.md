

## Corrigir import-media: salvar no filesystem (permanente)

O endpoint `import-media` usa Supabase Storage (bucket `chatbot-media`) que não existe na VPS. Precisa salvar no filesystem `/media-files/{userId}/` — mesma pasta usada pelo `media-upload` e referenciada pelo `group_scheduled_messages` (permanente, protegida pelo sanitize-storage).

### Alteração: `deploy/backend/src/routes/groups-api.ts`

**1. Adicionar imports** (linha 1-2):
```typescript
import fs from "fs";
import path from "path";
import crypto from "crypto";
```

**2. Substituir lógica de upload** (linhas 409-424):

Trocar o upload para Supabase Storage por escrita no filesystem:
```typescript
const ext = mediaPath.split('.').pop() || fileMimeType.split("/")[1]?.split("+")[0] || "bin";
const uniqueName = `${crypto.randomUUID()}.${ext}`;
const userDir = path.join("/media-files", userId);
fs.mkdirSync(userDir, { recursive: true });
const filePath = path.join(userDir, uniqueName);
fs.writeFileSync(filePath, fileBuffer);

const apiUrl = process.env.API_URL || "";
const publicUrl = `${apiUrl}/media/${userId}/${uniqueName}`;
console.log(`[import-media] Saved ${mediaPath} → ${publicUrl}`);
res.json({ oldPath: mediaPath, newUrl: publicUrl });
```

### Resultado
- Mídias importadas ficam em `/media-files/{userId}/` (mesma pasta do chatbot/grupos)
- Arquivos são permanentes — protegidos pelo sanitize-storage quando referenciados em `group_scheduled_messages`
- URLs no formato `/media/{userId}/arquivo.ext` (servidas pelo Nginx)
- Sem dependência do Supabase Storage

