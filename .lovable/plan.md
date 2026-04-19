

## Diagnóstico

Substituir Evolution por Baileys = reescrita massiva. Precisa: novo serviço `baileys-gateway` (container), gerenciador multi-instância, persistência de auth, tradução de eventos para o formato de webhook atual, refactor de ~10 rotas do backend, ajustes no compose/nginx, remoção de tudo Evolution (container, DB, Redis, env vars, volumes, código, memória).

## Decisões assumidas (não pergunto de novo — ritmo direto)

- **Cutover total**: derruba Evolution, todos reescaneiam QR. Sem paralelo.
- **Serviço separado** `baileys-gateway` (Node + `@whiskeysockets/baileys`) expondo HTTP REST compatível com o contrato Evolution atual (mesmas rotas/payloads que o backend já consome) — minimiza refactor do backend.
- **Auth state em Postgres** (tabela `baileys_auth_state` no `deploy-postgres-1`) — sobrevive a restart, multi-tenant.
- **Webhooks**: gateway POST para `http://backend:3001/api/webhook` no mesmo formato que Evolution mandava (events: `messages.upsert`, `messages.update`, `connection.update`, `send.message`, `groups.upsert`, `group-participants.update`).

## Arquitetura

```text
┌─────────────┐    HTTP REST     ┌──────────────────┐    WebSocket    ┌──────────┐
│  backend    │◄────────────────►│ baileys-gateway  │◄───────────────►│ WhatsApp │
│  (Express)  │                  │  (Node+Baileys)  │                 └──────────┘
└─────┬───────┘    webhook POST  └────────┬─────────┘
      │ ◄─────────────────────────────────┘
      ▼
   Postgres (auth state + dados de negócio)
```

Gateway expõe rotas que **imitam Evolution**:
- `POST /instance/create` `{instanceName}` → cria socket, persiste auth
- `GET /instance/connect/{instanceName}` → retorna QR base64
- `GET /instance/connectionState/{instanceName}`
- `DELETE /instance/logout/{instanceName}` / `DELETE /instance/delete/{instanceName}`
- `POST /message/sendText/{instanceName}`, `/sendMedia/`, `/sendWhatsAppAudio/`, `/sendButtons/`, `/sendList/`
- `GET /group/fetchAllGroups/{instanceName}`, `/group/findGroupInfos/{instanceName}`
- `POST /group/inviteCode/{instanceName}`, `/group/acceptInviteCode/{instanceName}`, `/group/updateParticipant/{instanceName}`
- `POST /chat/whatsappNumbers/{instanceName}` (validar número existe)
- `POST /chat/getBase64FromMediaMessage/{instanceName}` (download mídia)

Header `apikey` igual ao Evolution. Webhook global sai do gateway com mesmo schema (`event`, `instance`, `data.key.remoteJid`, etc.).

## Plano de execução

### Fase 1 — Novo serviço `baileys-gateway`
- `deploy/baileys-gateway/Dockerfile` (node:20-alpine + sharp + ffmpeg)
- `deploy/baileys-gateway/package.json` (`@whiskeysockets/baileys`, `express`, `pg`, `pino`, `qrcode`, `node-cache`)
- `deploy/baileys-gateway/src/index.ts` — bootstrap Express + carregar instâncias existentes do Postgres no startup
- `deploy/baileys-gateway/src/instance-manager.ts` — `Map<string, WASocket>`, criar/destruir, reconnect handling (DisconnectReason.loggedOut → limpar; outros → retry exponencial)
- `deploy/baileys-gateway/src/postgres-auth-state.ts` — implementação de `AuthenticationState` lendo/gravando em `baileys_auth_state` (creds + keys por instância)
- `deploy/baileys-gateway/src/event-bridge.ts` — traduz eventos Baileys → POST webhook no formato Evolution
- `deploy/baileys-gateway/src/routes/instance.ts`, `message.ts`, `group.ts`, `chat.ts` — rotas HTTP REST
- `deploy/baileys-gateway/src/lib/media.ts` — download e re-upload em `/media-files`

### Fase 2 — Banco
- `deploy/init-db.sql`: nova tabela `baileys_auth_state (instance_name text, key text, value jsonb, primary key(instance_name, key))`
- Remover bloco que cria DB `evolution` (não é mais necessário)

### Fase 3 — Docker compose + Nginx
- `deploy/docker-compose.yml` e `deploy/portainer-stack.yml`:
  - **Remover** service `evolution`
  - **Remover** service `redis` (Baileys não precisa — usa cache em memória + Postgres)
  - **Remover** volumes `chatbot_evolution_instances`, `chatbot_evolution_store`, `chatbot_redis`
  - **Adicionar** service `baileys-gateway` (porta interna 8080, mesmo nome de host esperado pelo backend)
  - **Trocar** env do backend: `EVOLUTION_URL` → `BAILEYS_URL=http://baileys-gateway:8080`, `EVOLUTION_API_KEY` → `BAILEYS_API_KEY` (mantém valor da var existente p/ não quebrar `.env`)
- `deploy/nginx/default.conf.template`: remover qualquer proxy direto pra `evolution:8080` (se houver)

### Fase 4 — Backend Express (refactor mínimo, troca de URL)
Como o gateway imita o contrato Evolution, **a maioria dos arquivos só precisa trocar a env var lida** (`EVOLUTION_URL` → `BAILEYS_URL`, `EVOLUTION_API_KEY` → `BAILEYS_API_KEY`):
- `deploy/backend/src/routes/whatsapp-proxy.ts`
- `deploy/backend/src/routes/groups-api.ts`
- `deploy/backend/src/routes/groups-webhook.ts`
- `deploy/backend/src/routes/webhook.ts`
- `deploy/backend/src/routes/extension-api.ts`
- `deploy/backend/src/routes/email.ts` (envio de boletos)
- `deploy/backend/src/lib/message-queue.ts`
- `deploy/backend/src/lib/recovery-dispatch.ts`
- `deploy/backend/src/lib/group-scheduler.ts`
- `deploy/backend/src/lib/resolve-phone-by-cpf.ts` (se usar Evolution)
Pequenos ajustes de payload onde Baileys diverge inevitavelmente (ex: status enum `sent/delivered/read` em vez de `SENT/DELIVERED/READ`) — tratado dentro do gateway pra normalizar.

### Fase 5 — Edge Function stub
- `supabase/functions/whatsapp-proxy/index.ts`: trocar mensagem de erro removendo menção a "Evolution API" → "Baileys gateway".

### Fase 6 — Frontend
- Buscar/remover toda string "Evolution" / "evolution" visível ao usuário (labels, toasts, placeholders).
- `src/hooks/useWhatsAppExtension.ts`, `useWhatsAppInstances.ts`, componentes de Settings/Connections — só renomear textos. Lógica não muda (chamam os mesmos endpoints do backend).

### Fase 7 — Limpeza Evolution
- `deploy/install.sh` / `deploy/update.sh`: remover passos referentes a Evolution (criação do DB `evolution`, healthcheck etc.).
- Remover memória `mem://tech/evolution-v2-infrastructure` e atualizar `mem://project/overview` + `mem://index.md` (substituir Evolution por Baileys nas Core rules).
- Criar memória `mem://tech/baileys-infrastructure` com nova arquitetura.
- README.md: trocar referências.
- `deploy/PORTAINER.md`: atualizar.

### Fase 8 — Migração na VPS (script)
Você roda na VPS depois do deploy:
```bash
cd ~/simplificandoconversas && git pull && bash deploy/update.sh
# Derruba Evolution definitivamente
docker compose stop evolution redis
docker compose rm -f evolution redis
docker volume rm deploy_chatbot_evolution_instances deploy_chatbot_evolution_store deploy_chatbot_redis
# (opcional) drop do DB evolution
docker exec deploy-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS evolution;"
# Sobe baileys-gateway
docker compose up -d --build baileys-gateway backend nginx
```
Cada usuário entra em **Configurações → Conexões**, deleta a instância antiga e recria (escaneia QR novo do Baileys).

## Validação

```bash
# Gateway de pé
docker logs deploy-baileys-gateway-1 --tail 50
curl -H "apikey: $BAILEYS_API_KEY" http://localhost:8080/instance/fetchInstances
# Backend conversando com gateway
docker logs deploy-backend-1 --tail 50 | grep -i baileys
# Frontend: criar instância nova → QR aparece → escanear → conectado → enviar mensagem teste
```

## Risco

**Alto.** Sessões caem, todos reescaneiam. Recomendo avisar usuários antes do deploy (janela de manutenção).

## Estimativa

~10 arquivos novos no `baileys-gateway`, ~12 arquivos do backend tocados (troca de env + ajustes pontuais), ~5 arquivos de infra, ~6 do frontend (texto), 4 memórias atualizadas. Total ~37 arquivos.

