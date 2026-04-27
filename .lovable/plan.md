## Estado atual (verificado)

A memória diz que o Baileys já substituiu o Evolution, mas **na prática o código não foi migrado**:

- `deploy/baileys-gateway/` só tem `Dockerfile` + `package.json`. Sem `src/`, sem `dist/`, sem servidor implementado.
- O helper `deploy/backend/src/lib/baileys-config.ts` citado na memória **não existe**.
- O backend continua 100% acoplado ao Evolution: `webhook.ts`, `whatsapp-proxy.ts`, `groups-api.ts`, `recovery-dispatch.ts`, `index.ts` usam `EVOLUTION_URL` / `EVOLUTION_API_KEY` e a função `evolutionRequest()`.
- `docker-compose.yml`, `portainer-stack.yml`, `stack.yml`, `install.sh`, `update.sh`, `init-roles.sh`, `nginx/default.conf.template`, `sanitize-storage.sh`, `evolution-msg-cleanup.sh` ainda contém a stack Evolution + Redis.
- Edge Function stub (`supabase/functions/whatsapp-proxy/index.ts`) e UI (`ConnectionsSection.tsx`) mencionam Evolution.

Ou seja: precisamos **construir o gateway Baileys do zero** e **reescrever toda a camada de envio/recebimento** do backend para falar com ele, mantendo o contrato externo (rotas e payloads de webhook idênticos) para não quebrar fluxos, follow-ups, recuperação, grupos e UI.

## Objetivo

Eliminar 100% do Evolution: imagem, container, Redis, env vars, código, nginx, scripts, stubs e textos. Tudo passa a operar via gateway Baileys próprio, com auth state em Postgres (`public.baileys_auth_state`) e webhooks compatíveis com o formato Evolution v2 que o `webhook.ts` já entende (preserva contrato).

## Plano

### 1. Construir o `baileys-gateway` (Node + TypeScript + Baileys)

Estrutura nova:

```text
deploy/baileys-gateway/
├── Dockerfile           (atualizar para build TS)
├── package.json         (adicionar typescript, tsx, @types)
├── tsconfig.json
└── src/
    ├── index.ts             # bootstrap Express + auth API key
    ├── auth-state.ts        # useAuthState custom em Postgres (public.baileys_auth_state)
    ├── instance-manager.ts  # cria/remove/restart instância Baileys, gerencia sockets
    ├── routes/
    │   ├── instance.ts      # /instance/create, /connect, /connectionState, /logout, /delete, /restart, /fetchInstances
    │   ├── message.ts       # /message/sendText, /sendMedia, /sendMediaPDF (compat Evolution)
    │   ├── chat.ts          # /chat/findChats, /findContacts, /fetchProfilePictureUrl, /getBase64FromMediaMessage, /findMessages, /whatsappNumbers
    │   └── group.ts         # /group/* equivalentes ao que groups-api.ts consome
    ├── webhook-emitter.ts   # POST WEBHOOK_GLOBAL_URL com {event, instance, data} (formato Evolution v2)
    └── lid-resolver.ts      # mantém política de @lid (mem://tech/lid-management-comprehensive)
```

Pontos-chave:
- **Auth state em Postgres**: tabela `public.baileys_auth_state (instance_name text pk, creds jsonb, keys jsonb, updated_at timestamptz)`. Substitui filesystem do Baileys e elimina dependência de Redis.
- **Eventos emitidos** com nomes/payloads idênticos aos eventos Evolution já consumidos por `webhook.ts` e `groups-webhook.ts`: `messages.upsert`, `messages.update`, `connection.update`, `send.message`, `groups.upsert`, `groups.update`, `group-participants.update`. Assim `webhook.ts` permanece intacto na ponta.
- **API Key** no header `apikey` (mesmo nome) lendo `BAILEYS_API_KEY`.
- **Endpoints REST** com mesmas rotas/paths que `evolutionRequest()` chama hoje, retornando JSON no mesmo formato. Isso permite que o backend só troque a base URL.

### 2. Reescrever camada do backend

Criar `deploy/backend/src/lib/baileys-config.ts`:

```ts
export const BAILEYS_URL = process.env.BAILEYS_URL || "http://baileys-gateway:8080";
export const BAILEYS_API_KEY = process.env.BAILEYS_API_KEY || "";
export async function baileysRequest(path, method = "POST", body?) { ... }
```

Substituir em **todos** os arquivos:

- `deploy/backend/src/routes/webhook.ts` — trocar `EVOLUTION_URL`, `evolutionRequest()` por `baileysRequest()`.
- `deploy/backend/src/routes/whatsapp-proxy.ts` — reescrever o proxy inteiro contra Baileys (manter mesmas operações expostas à UI: create-instance, connect, qr, logout, delete, send-message, find-chats, find-contacts, profile-pic, find-messages, set-presence, etc.). Remover textos "Evolution".
- `deploy/backend/src/routes/groups-api.ts` — trocar `getEvolutionConfig()` por `getBaileysConfig()`, atualizar exports e `normalizeEvolutionGroupsPayload` → `normalizeBaileysGroupsPayload`. Atualizar todos os 7 callers internos (linhas 649, 701, 1147, 1571, 1809…).
- `deploy/backend/src/lib/recovery-dispatch.ts` — substituir os 3 caminhos (sendText, sendMediaPDF, sendMediaImage) e o `whatsappNumberExists()` para Baileys. Remover comentários sobre "Evolution API expects raw base64".
- `deploy/backend/src/index.ts` — endpoint de restart (linhas 297-304) passa a chamar Baileys.
- `deploy/backend/src/lib/redis-cleanup.ts` — **deletar arquivo inteiro** e remover `import`/init em `index.ts`. Sem Redis, sem cleanup.

### 3. Limpar infraestrutura

- `deploy/stack.yml`, `deploy/portainer-stack.yml`, `deploy/docker-compose.yml`: remover serviços `evolution` e `redis`, volumes `*_evolution_instances`, `*_evolution_store`, `*_redis`. Remover env `EVOLUTION_*` e `CACHE_REDIS_*` do backend. Garantir que `baileys-gateway` esteja em todos com env `BAILEYS_API_KEY`, `DATABASE_URL`, `WEBHOOK_GLOBAL_URL=http://backend:3001/api/webhook`, `GROUPS_WEBHOOK_URL=http://backend:3001/api/groups/webhook/events`. Backend recebe `BAILEYS_URL=http://baileys-gateway:8080` e `BAILEYS_API_KEY`.
- `deploy/init-db.sql`: criar tabela `public.baileys_auth_state` + grants para `service_role`. Remover criação do database `evolution`.
- `deploy/init-roles.sh`: remover qualquer criação de role/db do Evolution.
- `deploy/install.sh` e `deploy/update.sh`: remover passos referentes a Evolution/Redis, adicionar build do `baileys-gateway` (npm run build no contexto do Dockerfile).
- `deploy/nginx/default.conf.template`: remover qualquer `proxy_pass` que aponte para `evolution:8080` (se houver).
- **Excluir arquivos**: `deploy/evolution-msg-cleanup.sh`, `deploy/sanitize-storage.sh` (revisar — só remover blocos Evolution se houver), `deploy/backend/src/lib/redis-cleanup.ts`.
- `deploy/.env.example`: remover `EVOLUTION_API_KEY`, adicionar `BAILEYS_API_KEY`.
- `deploy/PORTAINER.md`: atualizar instruções.

### 4. Frontend e Edge Functions

- `src/components/settings/ConnectionsSection.tsx`: substituir todas as menções textuais a "Evolution" por "WhatsApp" / "gateway" e badges relacionadas (sem mudança funcional — segue chamando `/api/whatsapp-proxy`).
- `supabase/functions/whatsapp-proxy/index.ts`: atualizar mensagem do stub (remover "Evolution API").
- `supabase/functions/execute-flow/index.ts`: remover textos Evolution se houver (apenas comentários/strings).
- Migrações antigas (`supabase/migrations/2026030*`) **não serão tocadas** — são histórico imutável.

### 5. Memória

Atualizar `mem://tech/baileys-infrastructure` confirmando que migração foi de fato concluída e remover do índice qualquer referência residual a Evolution.

## Detalhes técnicos

- **Compat de payload**: os webhooks emitidos pelo gateway devem espelhar exatamente `{event: "messages.upsert", instance: "<name>", data: {key, message, messageType, pushName}}` — é o que `webhook.ts` já parsea. O mapeamento Baileys→Evolution v2 é feito dentro de `webhook-emitter.ts`.
- **`getBase64FromMediaMessage`**: implementar usando `downloadMediaMessage` do Baileys, retornando `{ base64 }`.
- **`whatsappNumbers` / check de existência**: usar `sock.onWhatsApp([phone])` e responder no formato `[{ exists, jid }]` que `recovery-dispatch.ts` espera.
- **QR code**: emitir base64 PNG via `qrcode` ao receber evento `connection.update` com `qr`, expondo em `/instance/connect/:name`.
- **Persistência**: `useAuthState` custom grava creds/keys em `baileys_auth_state` a cada update. Sem volume Docker para Baileys.
- **Política de @lid**: manter `mem://tech/lid-management-comprehensive` — `lid-resolver.ts` traduz `@lid` para `@s.whatsapp.net` antes de emitir webhook.
- **Sem Redis**: cache Evolution era só para o próprio Evolution; o backend já não dependia dele para lógica de negócio (apenas `redis-cleanup.ts` operacional, que será removido).

## Observações importantes

- Como você usa **apenas a VPS**, a edge function stub permanece como stub — só atualizamos o texto.
- Após o deploy, instâncias atuais do Evolution **não migram automaticamente**: cada instância precisará reconectar via QR code novo (Baileys gera credenciais próprias). Isso é inevitável — não há export/import de auth state Evolution↔Baileys puro porque o Evolution v2 já encapsula o Baileys mas em formato proprietário no Postgres dele.
- Vou te enviar, ao final, instruções de deploy passo-a-passo para rodar dentro da VPS (build da imagem `simplificando-baileys`, migration SQL `baileys_auth_state`, redeploy da stack via Portainer, reconexão das instâncias).

Quer que eu prossiga exatamente nesse plano?