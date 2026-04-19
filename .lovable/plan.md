

## Diagnóstico

A mensagem "Aguardando mensagem. Essa ação pode levar alguns instantes" no WhatsApp do destinatário é **falha de descriptografia Signal/E2E**. O destinatário recebeu o pacote criptografado mas não tem a chave correta para abrir. Isso acontece quando:

1. **Sender keys defasadas** (principalmente em grupos após restart do gateway)
2. **`getMessage` retorna conteúdo vazio** no retry — o WhatsApp precisa do conteúdo original para re-criptografar
3. **`msgStore` é só em memória** — perde tudo no restart do container, nenhum retry funciona após deploy
4. **Falta `cachedGroupMetadata`** — Baileys re-busca metadata constantemente e pode usar lista de participantes desatualizada para distribuir sender keys

O fix anterior (Baileys 7.0.0-rc.9 + `getMessage` + `msgStore` + `clearSenderKeyMemory`) está incompleto: a função `clearSenderKeyMemory` foi criada mas nunca é chamada, e o `msgStore` é volátil.

## Plano de correção

### 1. Persistir `msgStore` em Postgres (`baileys_message_store`)

Nova tabela para sobreviver a restarts:
```text
baileys_message_store(instance_name, message_id, message jsonb, created_at)
```
- Auto-cleanup: manter só últimos 7 dias
- `getMessage` consulta a tabela quando memória não tem

### 2. Chamar `clearSenderKeyMemory` na reconexão de grupos

No `connection.update` quando `connection === "open"` E é uma reconexão (não primeiro QR), executar `clearSenderKeyMemory`. Isso força redistribuição de sender keys no próximo envio em grupo.

### 3. Adicionar `cachedGroupMetadata` ao socket

Cache de 5min para metadata de grupos, evita Baileys usar lista de participantes obsoleta:
```typescript
cachedGroupMetadata: async (jid) => groupMetadataCache.get(jid)
```

### 4. Atualizar handler de `groups.update` e `group-participants.update`

Invalidar cache quando participantes mudam, garantindo nova distribuição de sender keys.

### 5. Migration SQL para a tabela

Adicionar em `deploy/migrate-workspace.sql` (idempotente, pode rodar múltiplas vezes).

## Arquivos a editar

- `deploy/baileys-gateway/src/postgres-auth-state.ts` — adicionar `saveMessageToStore` / `getMessageFromStore`
- `deploy/baileys-gateway/src/instance-manager.ts` — usar store persistente, chamar `clearSenderKeyMemory` em reconexão, adicionar `cachedGroupMetadata`
- `deploy/migrate-workspace.sql` — criar tabela `baileys_message_store` + índice + cleanup function

## Comandos para aplicar na VPS (após o edit)

```bash
cd /opt/simplificandoconversas
git pull

cd deploy
set -a; source .env; set +a

PG=$(docker ps --filter name=simplificando_postgres --format '{{.Names}}' | head -1)
cat migrate-workspace.sql | docker exec -i "$PG" psql -U postgres -d postgres 2>&1 | grep -iE "create|notice|error" | tail -10
docker exec -i "$PG" psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"

cd /opt/simplificandoconversas
docker build -t simplificando-baileys-gateway:latest ./deploy/baileys-gateway
docker service update --force --image simplificando-baileys-gateway:latest simplificando_baileys-gateway
sleep 25
docker service logs simplificando_baileys-gateway --tail 30
```

Após reconectar todas as instâncias (ou aguardar 1 min para reconexão automática), o próximo envio em cada grupo redistribuirá sender keys corretas e a mensagem "Aguardando" some.

