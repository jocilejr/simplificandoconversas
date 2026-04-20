

## Diagnóstico final

Achei a causa raiz. Os 3 sintomas batem perfeitamente:

- Bloco A: `error: {}` `data: null` — `supabase-js` não consegue falar com `http://postgrest:3000`
- Bloco C: `[check-timeouts] Fetch error — raw keys: [] full: {}` repetindo — **mesmo erro**, em outra rota, várias vezes por minuto
- Bloco 5 anterior (curl cru): funcionou ✅

A diferença entre o que funciona e o que falha:
- **curl cru** → consegue resolver `postgrest:3000` no Docker
- **node + supabase-js dentro do mesmo container** → `fetch()` falha com erro vazio `{}`

Causa: o `supabase-js` v2 usa `fetch` global do Node. No container do backend, esse `fetch` está falhando ao resolver/conectar em `http://postgrest:3000` — provavelmente porque o Node não tem `undici`/DNS configurado igual ao curl, ou existe algum proxy/IPv6 atrapalhando. O erro `{}` é típico de `fetch` rejeitando sem `.message` enumerable.

Comprova: `check-timeouts` (que também usa supabase-js) está quebrado **desde o deploy**, mas você só percebeu agora porque o webhook tornou explícito.

## O que vou fazer

### 1. Forçar `supabase-js` a usar `node-fetch` explícito
**Arquivo:** `deploy/backend/src/lib/supabase.ts`

Passar um `fetch` customizado no `createClient`, garantindo conexão limpa via IPv4 e capturando o erro real:
```ts
import { Agent } from "undici";
const agent = new Agent({ connect: { family: 4 } }); // força IPv4
// passar fetch customizado pro createClient
```

### 2. Adicionar fallback REST direto
**Arquivo:** `deploy/backend/src/lib/supabase.ts`

Helper `restGet(table, query)` que faz `fetch` cru no PostgREST com headers de service role. Se `supabase-js` continuar falhando por algum motivo, o webhook usa o helper.

### 3. Trocar busca de workspace no manual-payment
**Arquivo:** `deploy/backend/src/routes/manual-payment-webhook.ts`

Usar o helper REST direto (que já provamos que funciona via curl) em vez do supabase-js só para o SELECT do workspace. Mantém supabase-js para os INSERTs (que o retry novo já cobre).

### 4. Logar erro real do supabase-js
**Arquivo:** `deploy/backend/src/lib/supabase.ts`

Wrapper que loga `err.cause`, `err.code`, `err.errno` quando o fetch falha — para nunca mais vermos `error: {}` mudo.

### 5. Corrigir `check-timeouts`
**Arquivo:** `deploy/backend/src/routes/check-timeouts.ts`

Mesmo padrão: usar helper REST ou cliente novo a cada chamada. Hoje está poluindo o log e travado.

### 6. Health check honesto
**Arquivo:** `deploy/backend/src/routes/health-db.ts`

Testar **os dois caminhos** (supabase-js e fetch direto) e reportar qual funciona. Hoje retorna `ok:false` sem dizer por quê.

## Validação na VPS após implementar

```bash
cd /opt/simplificandoconversas
bash deploy/update.sh

# Health novo deve dizer qual caminho funciona
curl -s https://interno.origemdavida.online/api/health/schema

# Webhook deve responder 200
curl -is -X POST "https://interno.origemdavida.online/functions/v1/manual-payment/webhook" \
  -H "Content-Type: application/json" \
  -d '{"workspace_id":"e73d46a8-32ea-450b-b6a0-05402e4420fd","event":"payment_pending","type":"pix","external_id":"teste-fix-001","amount":80,"customer_phone":"89981340810"}'

# Logs sem mais "[check-timeouts] Fetch error"
docker service logs simplificando_backend --since 2m 2>&1 | grep -iE "error|workspace" | tail -20
```

## Arquivos previstos

- `deploy/backend/src/lib/supabase.ts`
- `deploy/backend/src/routes/manual-payment-webhook.ts`
- `deploy/backend/src/routes/check-timeouts.ts`
- `deploy/backend/src/routes/health-db.ts`

## Risco

Baixo. Mudança é só na camada de transporte HTTP do backend. Não toca em SQL, RLS, schema ou regra de negócio. Resolve simultaneamente o `manual-payment` e o `check-timeouts` que está spammando log.

