---
name: Baileys infrastructure
description: Gateway próprio Node + Baileys, auth em Postgres, contrato Evolution-compat
type: feature
---
**Migração TOTAL concluída** — Evolution API + Redis foram **completamente removidos**.

Gateway próprio em `deploy/baileys-gateway/` (TypeScript + @whiskeysockets/baileys + express + pg):
- Container `baileys-gateway:8080`, imagem `simplificando-baileys:latest`.
- Auth state persistido em `public.baileys_auth_state` (instance_name, creds, keys, updated_at).
- Sem Redis, sem volumes Docker para auth.
- Endpoints REST com **mesmos paths e formato Evolution v2**: `/instance/{create,connect,connectionState,logout,delete,restart,fetchInstances}`, `/message/{sendText,sendMedia,sendMediaPDF}`, `/chat/{whatsappNumbers,fetchProfilePictureUrl,getBase64FromMediaMessage,findChats,findContacts,findMessages}`, `/group/{fetchAllGroups,inviteCode}`.
- Header de auth: `apikey: ${BAILEYS_API_KEY}`.
- Webhooks emitidos em formato Evolution v2 (`messages.upsert`, `messages.update`, `connection.update`, `groups.upsert`, `groups.update`, `group-participants.update`) para `WEBHOOK_GLOBAL_URL` (backend `/api/webhook`) e `GROUPS_WEBHOOK_URL` (backend `/api/groups/webhook/events`).
- Bootstrap automático: ao subir, restaura todas as instâncias com `creds IS NOT NULL` em `baileys_auth_state`.

Backend usa helper `deploy/backend/src/lib/baileys-config.ts` com `BAILEYS_URL`/`BAILEYS_API_KEY` e função `baileysRequest()`. `webhook.ts` e `whatsapp-proxy.ts` mantêm alias interno `evolutionRequest = baileysRequest` apenas por simetria com call sites; `groups-api.ts` usa `getBaileysConfig()`.

Removido do projeto:
- Service `evolution` e `redis` em `stack.yml`/`portainer-stack.yml`/`docker-compose.yml`.
- Volumes `*_evolution_instances`, `*_evolution_store`, `*_redis`.
- Env vars `EVOLUTION_*`, `CACHE_REDIS_*`.
- `deploy/backend/src/lib/redis-cleanup.ts` (deletado).
- `deploy/evolution-msg-cleanup.sh` (deletado).
- Criação do database `evolution` em `init-roles.sh`.

**Migração de instâncias**: ao migrar de Evolution para Baileys, cada instância precisa ser **reconectada via QR novo** (auth state Evolution não é portável).
