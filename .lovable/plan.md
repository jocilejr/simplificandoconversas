

## Plano: Botão "Sincronizar" + Correção do payload do webhook

### Problema raiz
O `set-webhook` está enviando o payload com estrutura **nested** (`{ webhook: { url, ... } }`), mas a Evolution API v2 espera propriedades **flat** com `enabled: true` obrigatório:

```json
{
  "enabled": true,
  "url": "https://...",
  "webhook_by_events": false,
  "webhook_base64": true,
  "events": ["MESSAGES_UPSERT", ...]
}
```

Isso explica por que a instância "Meire Rosana - Entregas" ainda aparece sem webhook no painel do Evolution.

### Correções

#### 1. Corrigir payload do `set-webhook` em `evolution-proxy/index.ts`
Mudar de `{ webhook: { ... } }` para payload flat com `enabled: true`, `url`, `webhook_by_events`, `webhook_base64`, `events`.

#### 2. Adicionar action `sync-webhooks` no `evolution-proxy/index.ts`
Nova action que busca todas as instâncias do usuário e configura o webhook em cada uma delas de uma vez.

#### 3. Adicionar botão "Sincronizar" na `ConnectionsSection.tsx`
Botão visível no header das instâncias vinculadas. Ao clicar, chama `sync-webhooks` que configura webhook em todas as instâncias vinculadas.

#### 4. Adicionar mutation `syncWebhooks` no `useEvolutionInstances.ts`
Nova mutation que invoca a action `sync-webhooks`.

### Arquivos a editar
- `supabase/functions/evolution-proxy/index.ts` — corrigir payload flat + nova action `sync-webhooks`
- `src/hooks/useEvolutionInstances.ts` — nova mutation `syncWebhooks`
- `src/components/settings/ConnectionsSection.tsx` — botão "Sincronizar"

