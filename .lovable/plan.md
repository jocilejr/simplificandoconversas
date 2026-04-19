

## Objetivo

O sintoma "Aguardando mensagem" persiste mesmo após os fixes anteriores no gateway. O usuário quer alinhar a implementação do **baileys-gateway** ao repositório de referência `jocilejr/whats-grupos` (que funciona corretamente) — sem quebrar as features atuais (multi-instância, auth state em Postgres, webhook bridge, message store, rotas REST compatíveis com o backend).

## Investigação necessária ANTES de refatorar

Preciso comparar o gateway atual com o do repo de referência para identificar exatamente o que está diferente. Sem isso, "deixar semelhante" vira chute.

### Passo 1 — Mapear o repo de referência

Vou ler do GitHub `jocilejr/whats-grupos`:
- Estrutura de pastas do gateway/baileys
- `package.json` (versão do `@whiskeysockets/baileys` e deps)
- Inicialização do socket (`makeWASocket` config: `version`, `browser`, `printQRInTerminal`, `syncFullHistory`, `markOnlineOnConnect`, `getMessage`, `shouldIgnoreJid`, `patchMessageBeforeSending`, `cachedGroupMetadata`)
- Implementação do `getMessage` (essencial para destravar "Aguardando mensagem")
- Tratamento de `connection.update` (códigos de disconnect, reconexão, QR)
- Como salva/recupera mensagens (auth state + message store)
- Eventos `messages.upsert` (persistência antes de webhook)

### Passo 2 — Diff conceitual com o gateway atual

Comparar contra:
- `deploy/baileys-gateway/src/instance-manager.ts`
- `deploy/baileys-gateway/src/postgres-auth-state.ts`
- `deploy/baileys-gateway/src/db.ts`
- `deploy/baileys-gateway/src/index.ts`
- `deploy/baileys-gateway/package.json`

Listar pontos de divergência que podem causar "Aguardando mensagem" (geralmente: `getMessage` retornando vazio, `cachedGroupMetadata` ausente, `version` desatualizada do WA, `patchMessageBeforeSending` faltando para botões/listas, ou `syncFullHistory:false` quando deveria ser `true`).

### Passo 3 — Refatorar de forma cirúrgica (preserva contratos)

Aplicar APENAS as mudanças que o repo de referência faz diferente, mantendo:
- Endpoints REST atuais (`/instance/*`, `/message/*`, `/chat/*`, `/group/*`) que o backend chama
- Auth state em Postgres (não migrar para arquivo — quebraria persistência)
- Webhook global (`WEBHOOK_GLOBAL_URL`) para o backend
- Message store em Postgres (auto-criação no boot, já implementada)
- Multi-instância via `instance-manager`
- Variáveis de ambiente atuais

Provavelmente vou:
1. Atualizar/alinhar versão do `@whiskeysockets/baileys` à do repo de referência
2. Reescrever a config do `makeWASocket` espelhando a do repo (inclusive `getMessage`, `cachedGroupMetadata`, `shouldSyncHistoryMessage`, `browser` ID, `version` via `fetchLatestBaileysVersion`)
3. Garantir que `messages.upsert` salva TUDO no store antes do webhook, e que `getMessage` lê primeiro do store, depois Postgres
4. Tratar disconnect codes idêntico ao repo (badSession/restartRequired/connectionReplaced/loggedOut/multideviceMismatch/timedOut)
5. Logs verbosos para confirmar caminho de cada mensagem

### Passo 4 — Pacote pra VPS

Comandos prontos pro usuário rodar:
```bash
cd /opt/simplificandoconversas
bash deploy/update.sh
docker service logs simplificando_baileys-gateway --tail 80
# tentar enviar mensagem em DM e em grupo
docker service logs simplificando_baileys-gateway --tail 30 -f
```

## Arquivos que serão editados

(definidos APÓS leitura do repo de referência — sem chutar agora)

Provavelmente:
- `deploy/baileys-gateway/package.json` (alinhar versão Baileys)
- `deploy/baileys-gateway/src/instance-manager.ts` (config do socket + getMessage + reconnect)
- `deploy/baileys-gateway/src/postgres-auth-state.ts` (refinar persistência se divergir)
- `deploy/baileys-gateway/src/routes/message.ts` (se o repo trata payload diferente)

Não vou tocar:
- Frontend
- Backend (`deploy/backend/*`)
- Tabelas / SQL
- Nginx / stack.yml / update.sh

## Garantias de não-regressão

- Manter assinatura HTTP de todas as rotas existentes
- Manter formato dos eventos enviados ao webhook (o backend depende disso)
- Manter `BAILEYS_API_KEY` como auth header
- Manter auto-criação de `baileys_message_store` no boot
- Manter logs explícitos de hit/miss adicionados anteriormente

## Próximo passo

Confirmar este plano. Ao aprovar, vou:
1. Buscar a estrutura do repo `jocilejr/whats-grupos` (raw GitHub)
2. Ler os arquivos relevantes do gateway lá
3. Apresentar o diff conceitual
4. Refatorar

