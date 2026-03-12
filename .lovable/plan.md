

## Problema

O `MediaUpload` usa `supabase.storage.from("chatbot-media").upload()` diretamente. Na VPS, o Supabase Storage tem restricoes de RLS que impedem o upload. A arquitetura do projeto ja usa filesystem + Nginx (`/media/`) para servir arquivos.

## Solucao

Criar um endpoint de upload no backend Express e alterar o `MediaUpload` para enviar arquivos via esse endpoint (que salva no filesystem compartilhado).

## Alteracoes

### 1. `deploy/backend/src/routes/whatsapp-proxy.ts` — Novo endpoint `media-upload`

Adicionar handler para `action: "media-upload"`:
- Receber arquivo como base64 no body (junto com `fileName`, `mimetype`)
- Extrair `userId` do token JWT no header Authorization
- Salvar em `/media-files/{userId}/{uuid}.{ext}`
- Retornar URL publica: `${API_URL}/media/{userId}/{uuid}.{ext}`

### 2. `src/components/chatbot/MediaUpload.tsx` — Usar backend em vez de Supabase Storage

- Converter arquivo para base64 no frontend
- Enviar via `supabase.functions.invoke("whatsapp-proxy", { body: { action: "media-upload", ... } })`
- Na VPS, o Nginx redireciona para o backend Express
- Usar a URL retornada pelo backend

### 3. `deploy/backend/package.json` — Sem dependencias novas

O `fs` e nativo do Node.js, nao precisa de pacotes adicionais.

