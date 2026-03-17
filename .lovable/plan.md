

## Diagnóstico: Meta Pixel Conversions API -- Eventos Não Aparecem no Ads Manager

### Problema Identificado

O código envia eventos para a Meta Conversions API, mas usa configurações que impedem a atribuição correta nos anúncios. Existem **4 problemas** no payload enviado:

### 1. `action_source: "system_generated"` (PRINCIPAL)

A Meta **ignora eventos com `action_source: "system_generated"` para atribuição de anúncios**. Esse valor é reservado para eventos internos do sistema. Para que conversões apareçam no Ads Manager, o `action_source` precisa ser `"website"`, `"phone_call"`, `"chat"`, `"other"` ou outro valor válido de atribuição.

No contexto de chatbot WhatsApp, o valor correto é **`"chat"`** ou **`"other"`**.

### 2. Falta de `event_id` (deduplicação)

A Meta pode descartar eventos sem `event_id` em cenários de deduplicação. Cada evento precisa de um ID único.

### 3. Formato do telefone antes de hashear

A Meta exige que o telefone seja normalizado (sem `+`, sem espaços, sem zeros à esquerda) **antes** de hashear com SHA-256. O código atual já remove caracteres não-numéricos, o que está correto, mas pode faltar o prefixo de país em alguns casos.

### 4. Falta de `event_source_url` (opcional mas recomendado)

Esse campo ajuda na atribuição. Pode usar a URL pública do app configurada em `profiles.app_public_url`.

---

### Plano de Implementação

**Arquivo**: `deploy/backend/src/routes/execute-flow.ts`

Alterar o payload do Meta Pixel em **dois lugares** (standalone node ~linha 475 e group node ~linha 704):

```text
Antes:
  action_source: "system_generated"
  (sem event_id)

Depois:
  action_source: "chat"
  event_id: crypto.randomUUID()
  event_source_url: profile?.app_public_url || undefined
```

**Arquivo**: `deploy/backend/src/routes/health-db.ts`

Alterar o endpoint de teste para usar o mesmo `action_source: "chat"`.

**Arquivo**: `supabase/functions/execute-flow/index.ts`

Aplicar as mesmas correções na Edge Function (stub, mas mantém paridade).

### Resumo das Alterações

- Trocar `action_source` de `"system_generated"` para `"chat"` em 4 lugares (2 no backend, 1 no health-db, 1 na edge function)
- Adicionar `event_id: crypto.randomUUID()` em cada evento
- Adicionar `event_source_url` usando `app_public_url` do perfil quando disponível

Após implementar, rode `update.sh` na VPS e teste com o endpoint de diagnóstico:
```bash
curl -X POST http://localhost:3001/api/health/meta-pixel-test \
  -H "Content-Type: application/json" \
  -d '{"pixel_id":"SEU_PIXEL_ID","access_token":"SEU_TOKEN","phone":"5588999999999"}'
```

