

## Problema

Os logs mostram claramente: `"webhook requires property \"enabled\""`. A propriedade `enabled: true` está faltando **dentro** do objeto `webhook`. A Evolution API exige essa propriedade mesmo dentro da estrutura nested.

## Correção

Adicionar `enabled: true` dentro do objeto `webhook` em ambos os cases (`set-webhook` linha 266 e `sync-webhooks` linha 304):

```typescript
webhook: {
  enabled: true,  // ← faltando
  url: webhookUrl,
  byEvents: false,
  base64: true,
  events: [...]
}
```

### Arquivo a editar
- `supabase/functions/evolution-proxy/index.ts` — adicionar `enabled: true` nas linhas 267 e 305.

