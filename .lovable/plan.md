

## Remover Baileys completamente e substituir por Evolution API

### Escopo

Substituir toda a infraestrutura Baileys (serviço standalone + integração no backend Express) pela Evolution API v2, rodando como container Docker. São ~15 arquivos afetados.

### Arquitetura Nova

```text
Frontend → Nginx → Backend Express (whatsapp-proxy) → Evolution API (porta 8084)
                                                     ↑
                          Evolution envia webhooks → Backend Express (/api/webhook)
```

O Evolution API é um container Docker pronto (`atendai/evolution-api`) que expõe uma REST API completa para WhatsApp, substituindo completamente o serviço Baileys customizado.

### Mudanças por arquivo

**1. Deletar `deploy/baileys-service/` inteiro**
- `src/index.ts`, `package.json`, `tsconfig.json`, `Dockerfile` — tudo removido

**2. `deploy/docker-compose.yml`** — Substituir container `baileys` por `evolution`:
```yaml
evolution:
  image: atendai/evolution-api:v2.2.3
  restart: always
  environment:
    SERVER_URL: ${API_URL}
    AUTHENTICATION_TYPE: apikey
    AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY}
    AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES: "true"
    DATABASE_ENABLED: "false"
    WEBHOOK_GLOBAL_URL: http://backend:3001/api/webhook
    WEBHOOK_GLOBAL_ENABLED: "true"
    WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS: "true"
    WEBHOOK_EVENTS_MESSAGES_UPSERT: "true"
    WEBHOOK_EVENTS_MESSAGES_UPDATE: "true"
    WEBHOOK_EVENTS_CONNECTION_UPDATE: "true"
    WEBHOOK_EVENTS_SEND_MESSAGE: "true"
  volumes:
    - chatbot_evolution_instances:/evolution/instances
    - chatbot_evolution_store:/evolution/store
```
- Backend env: `EVOLUTION_URL: http://evolution:8080`, `EVOLUTION_API_KEY: ${EVOLUTION_API_KEY}`
- Remover `BAILEYS_URL`, `BAILEYS_API_KEY`
- Remover volume `chatbot_baileys_sessions`, adicionar `chatbot_evolution_instances` e `chatbot_evolution_store`

**3. `deploy/portainer-stack.yml`** — Mesma mudança do docker-compose

**4. `deploy/nginx/default.conf.template`** — Renomear location `/baileys/` para `/evolution/` apontando para `http://evolution:8080/`

**5. `deploy/backend/src/routes/whatsapp-proxy.ts`** — Reescrever para usar Evolution API REST:
- Substituir `baileysRequest()` por `evolutionRequest()` apontando para `EVOLUTION_URL`
- Usar header `apikey: EVOLUTION_API_KEY` (formato Evolution)
- Endpoints Evolution: `/instance/create`, `/instance/connect/{name}`, `/instance/delete/{name}`, `/instance/connectionState/{name}`, `/message/sendText/{name}`, `/message/sendMedia/{name}`, `/message/sendWhatsAppAudio/{name}`, `/chat/fetchProfilePictureUrl/{name}`

**6. `deploy/backend/src/routes/webhook.ts`** — Adaptar formato de webhook da Evolution API:
- Formato do payload: `{ event, instance, data: { key, pushName, message, messageTimestamp } }`
- A função `downloadAndUploadMedia` usará `getBase64FromMediaMessage` da Evolution API
- Estrutura similar, ajustar nomes de campos conforme API

**7. `deploy/backend/src/routes/execute-flow.ts`** — Trocar `BAILEYS_URL`/`BAILEYS_API_KEY` por `EVOLUTION_URL`/`EVOLUTION_API_KEY`, renomear funções

**8. `supabase/functions/execute-flow/index.ts`** — Trocar variáveis `BAILEYS_*` por `EVOLUTION_*`

**9. `deploy/install.sh`** — Reescrever:
- Remover geração de `BAILEYS_API_KEY`, pedir/gerar `EVOLUTION_API_KEY`
- Atualizar `.env` gerado
- Remover qualquer referência a Baileys

**10. `deploy/update.sh`** — Sem mudanças estruturais (já genérico)

**11. `deploy/.env.example`** — Trocar `BAILEYS_API_KEY` por `EVOLUTION_API_KEY`

**12. `deploy/init-db.sql`** — Sem mudanças (já usa `whatsapp_instances`)

**13. `src/hooks/useContactPhoto.ts`** — Remover comentários "Baileys API"

**14. `deploy/PORTAINER.md`** — Trocar referências Baileys por Evolution

**15. `supabase/functions/whatsapp-proxy/index.ts`** — Atualizar mensagem stub

### Resultado

Zero referências a "Baileys" no projeto. O sistema usa exclusivamente Evolution API v2 como provedor WhatsApp, rodando como container Docker gerenciado.

