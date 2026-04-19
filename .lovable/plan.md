

Usuário quer:
1. Implementar o fix de visibilidade do gateway (logs + DM recovery + auto-schema) que já foi planejado
2. **Reformar `update.sh`** para ser minimalista e seguro — sem recriar tabelas, sem migrations agressivas, sem derrubar o servidor inteiro
3. Migrations de tabela ele faz na mão

## Plano

### 1. `deploy/update.sh` — modo seguro/mínimo

Remover completamente o passo `[2/5] migrations` que faz `cat migrate-workspace.sql + init-db.sql + fix-member-tables.sql | psql`. Esse bloco é o que “quebra o servidor inteiro” quando há divergência de schema.

Novo fluxo enxuto:
- `[1/4]` git pull
- `[2/4]` rebuild frontend (só copia `dist/` se build OK — já tem essa proteção)
- `[3/4]` rebuild imagens locais (backend + baileys-gateway)
- `[4/4]` `docker service update --force` em backend, baileys-gateway, nginx (Swarm) ou `docker compose up -d` (Compose)
- Health check final

Sem migrations automáticas. Sem `NOTIFY pgrst`. Sem mexer em Postgres.
Manter detecção Swarm vs Compose.
Manter validação de build do frontend (não sobrescreve `dist/` se quebrou).

Mensagem final lembra: “Se houver mudança de schema, rode os SQLs manualmente antes/depois.”

### 2. Gateway — visibilidade + DM recovery + auto-schema

**`deploy/baileys-gateway/src/db.ts`**
Mover criação de `baileys_message_store` para dentro de `ensureSchema()` (idempotente, `CREATE TABLE IF NOT EXISTS`). Assim o gateway se auto-cura no boot sem depender de SQL externo.

**`deploy/baileys-gateway/src/postgres-auth-state.ts`**
- `saveMessageToStore`: log explícito de sucesso/erro (não mais silencioso)
- `getMessageFromStore`: log hit/miss

**`deploy/baileys-gateway/src/instance-manager.ts`**
- `getMessage`: log indicando origem (memória / postgres / stub vazio) com `messageId`
- `messages.upsert` outbound: log do `messageId` salvo
- `connection.update`:
  - log do motivo do disconnect (statusCode + descrição)
  - tratar `badSession`, `restartRequired`, `connectionReplaced`, `multideviceMismatch` com recriação limpa do socket
  - log de reconexão bem-sucedida + se chamou `clearSenderKeyMemory`

**`deploy/baileys-gateway/src/routes/message.ts`**
- log no início de cada envio: instância, jid, tipo
- log no sucesso com `messageId` retornado
- log de erro com contexto

### 3. Comandos VPS pós-deploy (eu entrego prontos)

Build + update do gateway + verificação de logs + verificação da tabela auto-criada. Sem rodar migration nenhuma.

## Arquivos editados

- `deploy/update.sh`
- `deploy/baileys-gateway/src/db.ts`
- `deploy/baileys-gateway/src/postgres-auth-state.ts`
- `deploy/baileys-gateway/src/instance-manager.ts`
- `deploy/baileys-gateway/src/routes/message.ts`

## Resultado esperado

- `update.sh` nunca mais toca em SQL — risco zero de quebrar Postgres em update
- Gateway cria sua própria tabela no boot
- Próxima ocorrência de “Aguardando mensagem” gera log explícito mostrando exatamente onde quebrou (store vazio / sessão corrompida / reconnect incompleto)
- Sessões DM corrompidas se autorrecuperam via tratamento explícito de disconnect codes

