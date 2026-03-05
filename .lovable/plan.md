

## Deploy Self-Hosted Completo: Frontend + Backend + Baileys Puro

### Escopo

Criar um pacote completo de deploy em `deploy/` que o usuário roda `./install.sh` na VPS e tudo sobe: PostgreSQL, Supabase (GoTrue + PostgREST + Storage), Backend Node.js (conversão das 5 Edge Functions), serviço WhatsApp com Baileys puro, Nginx como reverse proxy, e o frontend React buildado.

### Arquitetura

```text
┌──────────────────────────────────────────────────────────────┐
│  VPS (Docker Compose)                                        │
│                                                              │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  ┌────────┐ │
│  │  Nginx   │  │ PostgreSQL│  │  GoTrue      │  │Storage │ │
│  │  :80/443 │  │  :5432    │  │  (Auth) :9999│  │ :5000  │ │
│  └────┬─────┘  └─────┬─────┘  └──────────────┘  └────────┘ │
│       │              │                                       │
│  ┌────┴──────────────┴──────┐  ┌───────────────────────────┐│
│  │  PostgREST :3000         │  │  Baileys Service :8084    ││
│  │  (API REST do banco)     │  │  - QR Code auth           ││
│  │                          │  │  - Send/receive messages  ││
│  └──────────────────────────┘  │  - Webhook → Backend      ││
│                                └───────────────────────────┘│
│  ┌──────────────────────────┐                                │
│  │  Backend (Express) :3001 │  ┌───────────────────────────┐│
│  │  - /api/webhook          │  │  Frontend (static)        ││
│  │  - /api/execute-flow     │  │  React build via Nginx    ││
│  │  - /api/proxy            │  └───────────────────────────┘│
│  │  - /api/link-redirect    │                                │
│  │  - cron: check-timeouts  │                                │
│  └──────────────────────────┘                                │
└──────────────────────────────────────────────────────────────┘
```

### Arquivos a criar (~20 arquivos)

#### Infraestrutura Docker

1. **`deploy/docker-compose.yml`**
   - PostgreSQL 15 com volume persistente
   - GoTrue (auth.supabase.io) para autenticação JWT
   - PostgREST para API REST do banco (compatível com supabase-js)
   - Supabase Storage para uploads de mídia
   - Baileys Service (Node.js customizado)
   - Backend Express (conversão das Edge Functions)
   - Nginx (frontend + reverse proxy)

2. **`deploy/.env.example`**
   - `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`
   - `APP_URL` (domínio da VPS)
   - `OPENAI_API_KEY` (opcional)

3. **`deploy/nginx/default.conf`**
   - `/` → frontend estático
   - `/rest/v1/*` → PostgREST (compatibilidade supabase-js)
   - `/auth/v1/*` → GoTrue
   - `/storage/v1/*` → Storage
   - `/functions/v1/*` → Backend Express (compatibilidade total com frontend)
   - `/baileys/*` → Baileys Service

#### Baileys Service (WhatsApp)

4. **`deploy/baileys-service/package.json`**
5. **`deploy/baileys-service/src/index.ts`**
   - Conexão Baileys com sessão persistente (volume Docker)
   - API REST compatível com os endpoints que o sistema usa:
     - `POST /message/sendText/:instance`
     - `POST /message/sendMedia/:instance`
     - `POST /message/sendWhatsAppAudio/:instance`
     - `POST /message/sendPresence/:instance`
     - `POST /instance/connect/:instance` (retorna QR code)
     - `POST /instance/create`
     - `GET /instance/fetchInstances`
     - `GET /instance/connectionState/:instance`
     - `DELETE /instance/delete/:instance`
     - `POST /chat/findMessages/:instance`
     - `POST /chat/findChats/:instance`
     - `POST /chat/findContacts/:instance`
     - `POST /chat/fetchProfilePictureUrl/:instance`
     - `POST /chat/getBase64FromMediaMessage/:instance`
   - Webhook automático: ao receber mensagem, faz POST para `http://backend:3001/api/webhook`
   - Suporte multi-instância (cada instância = pasta de sessão separada)
6. **`deploy/baileys-service/Dockerfile`**

#### Backend Express (Conversão das Edge Functions)

7. **`deploy/backend/package.json`**
8. **`deploy/backend/tsconfig.json`**
9. **`deploy/backend/src/index.ts`** - Express server, cron para check-timeouts
10. **`deploy/backend/src/lib/supabase.ts`** - Cliente PostgREST via supabase-js
11. **`deploy/backend/src/routes/webhook.ts`** - Conversão de `evolution-webhook/index.ts`
12. **`deploy/backend/src/routes/execute-flow.ts`** - Conversão de `execute-flow/index.ts`
13. **`deploy/backend/src/routes/evolution-proxy.ts`** - Conversão de `evolution-proxy/index.ts` (agora aponta para Baileys Service local)
14. **`deploy/backend/src/routes/link-redirect.ts`** - Conversão de `link-redirect/index.ts`
15. **`deploy/backend/src/routes/check-timeouts.ts`** - Conversão de `check-timeouts/index.ts`
16. **`deploy/backend/Dockerfile`**

#### Database

17. **`deploy/init-db.sql`** - Consolidação das 26 migrations em um único SQL (todas as tabelas, funções, triggers, RLS, storage bucket, GoTrue schema)

#### Scripts

18. **`deploy/install.sh`** - Script automatizado:
    1. Verifica Docker/Docker Compose
    2. Gera JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY automaticamente
    3. Cria `.env` a partir do template
    4. Builda frontend React (`npm ci && npm run build`)
    5. Copia `dist/` para `deploy/frontend/`
    6. `docker compose up -d --build`
    7. Aguarda PostgreSQL → executa `init-db.sql`
    8. Exibe URL de acesso

19. **`deploy/update.sh`** - Rebuild e restart após mudanças

#### Frontend Patch

20. **`deploy/patch-frontend.sh`** - Script que ajusta o `.env` do frontend para apontar `VITE_SUPABASE_URL` para a URL local da VPS (PostgREST + GoTrue via Nginx)

### Conversão Deno → Node.js

Mudanças padrão aplicadas em todas as rotas:
- `Deno.env.get("X")` → `process.env.X`
- `Deno.serve()` → `router.post()/router.get()`
- `createClient` import de `@supabase/supabase-js` (npm)
- `crypto.randomUUID()` → `crypto.randomUUID()` (Node 19+)
- URLs internas (`SUPABASE_URL/functions/v1/execute-flow`) → `http://localhost:3001/api/execute-flow`

### Baileys Service: Compatibilidade

O serviço Baileys expõe endpoints no mesmo formato da Evolution API, para que o `evolution-proxy` e `execute-flow` funcionem sem alteração de lógica. A diferença é que o URL base aponta para `http://baileys:8084` internamente no Docker.

### Resultado final

```bash
git clone <repo>
cd deploy
./install.sh
# → Sistema completo rodando na VPS
# → Acesse http://sua-vps-ip para usar
```

