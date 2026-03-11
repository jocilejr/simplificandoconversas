

## Problema: Mídia não funciona na VPS

Existem **dois problemas** impedindo imagens, vídeos e áudios de funcionarem:

### Problema 1: Bucket `chatbot-media` pode não existir
O `init-db.sql` nunca cria o bucket. Ele tem apenas um comentário dizendo "crie manualmente". Sem o bucket, todo upload falha silenciosamente.

### Problema 2: URL pública é interna (Docker)
Quando o backend gera a URL pública via `getPublicUrl()`, ele usa `SUPABASE_URL = http://nginx:80`. Isso gera URLs como:
```
http://nginx:80/storage/v1/object/public/chatbot-media/xxx.jpg
```
O navegador do usuário **não consegue acessar** `http://nginx:80` -- isso é a rede interna do Docker.

A URL correta deveria ser:
```
https://api.seudominio.com/storage/v1/object/public/chatbot-media/xxx.jpg
```

### Correções

**1. `deploy/init-db.sql`** -- Adicionar criação do bucket
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('chatbot-media', 'chatbot-media', true)
ON CONFLICT (id) DO NOTHING;
```
E policy de acesso público para leitura:
```sql
CREATE POLICY "Public read chatbot-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'chatbot-media');

CREATE POLICY "Auth upload chatbot-media" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chatbot-media');
```

**2. `deploy/backend/src/routes/webhook.ts`** -- Corrigir URL pública
Após gerar a `publicUrl`, substituir a URL interna pela externa usando `process.env.API_URL`:
```typescript
const internalUrl = publicUrl?.publicUrl || null;
if (internalUrl) {
  return internalUrl.replace(process.env.SUPABASE_URL || "http://nginx:80", process.env.API_URL || "");
}
return null;
```

**3. `deploy/backend/src/routes/whatsapp-proxy.ts`** -- Mesma correção para o proxy
Aplicar a mesma substituição de URL na função `downloadAndUploadMedia`.

**4. Comando manual na VPS** -- Para criar o bucket no banco existente (sem recriar):
```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "
INSERT INTO storage.buckets (id, name, public)
VALUES ('chatbot-media', 'chatbot-media', true)
ON CONFLICT (id) DO NOTHING;"
```

### Arquivos alterados
- `deploy/init-db.sql` -- criar bucket + policies
- `deploy/backend/src/routes/webhook.ts` -- corrigir URL pública
- `deploy/backend/src/routes/whatsapp-proxy.ts` -- corrigir URL pública

