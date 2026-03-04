

## Problema

Os logs confirmam o erro: `"instance requires property \"webhook\""`. O endpoint `/webhook/set/{instance}` da Evolution API exige que o payload contenha uma propriedade **`webhook`** como wrapper (estrutura nested), igual ao `create-instance`. Porém o código atual de `set-webhook` e `sync-webhooks` envia propriedades flat (`enabled`, `url`, `webhook_by_events`).

## Correção

Alterar o body de **ambos** os cases (`set-webhook` e `sync-webhooks`) em `evolution-proxy/index.ts` para usar a estrutura nested:

```json
{
  "webhook": {
    "url": "https://...",
    "byEvents": false,
    "base64": true,
    "events": ["MESSAGES_UPSERT", ...]
  }
}
```

Isso replica exatamente a mesma estrutura que já funciona no `create-instance` (linhas 164-178).

### Arquivo a editar
- `supabase/functions/evolution-proxy/index.ts` — linhas 265-275 (`set-webhook`) e 302-313 (`sync-webhooks`): trocar payload flat por nested `webhook` object.

