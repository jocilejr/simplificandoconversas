

## Problema

O Storage API do Supabase **sempre** aplica RLS internamente, independente do JWT ou role. Todas as tentativas via SQL (BYPASSRLS, DISABLE RLS, policies permissivas) falharam -- provavelmente porque o container Storage cacheia conexões ou aplica verificações próprias em código.

## Nova abordagem: Filesystem + Nginx

Abandonar completamente o Supabase Storage API. Salvar os arquivos diretamente no filesystem via um volume Docker compartilhado entre o backend e o Nginx, e servir os arquivos estaticamente pelo Nginx.

```text
WhatsApp → Evolution → Webhook (backend)
                          ↓
                    fs.writeFile() → /media-files/userId/uuid.ext
                          ↓
                    Nginx serves → /media/userId/uuid.ext
                          ↓
                    URL pública: https://API_DOMAIN/media/userId/uuid.ext
```

## Alteracoes

### 1. `deploy/backend/src/routes/webhook.ts` -- `downloadAndUploadMedia`

Substituir o upload HTTP ao Storage por `fs.writeFile`:
- Importar `fs/promises` e `path`
- Criar diretório `/media-files/{userId}/` se nao existir (`mkdir -p`)
- Escrever o buffer binário no arquivo
- Retornar URL pública: `${API_URL}/media/${fileName}`

### 2. `deploy/docker-compose.yml`

- Criar volume compartilhado `chatbot_media` 
- Montar no backend: `chatbot_media:/media-files`
- Montar no Nginx: `chatbot_media:/usr/share/nginx/media:ro`

### 3. `deploy/nginx/default.conf.template`

Adicionar bloco no server da API:
```nginx
location /media/ {
    alias /usr/share/nginx/media/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 4. `deploy/portainer-stack.yml`

Mesmas alteracoes de volume e montagem do docker-compose.

### Resultado

- Zero dependencia do Supabase Storage API
- Sem RLS, sem roles, sem policies
- Arquivos servidos diretamente pelo Nginx (rapido, cache headers)
- Apenas rebuild do backend + restart do Nginx

