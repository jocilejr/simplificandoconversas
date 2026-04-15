

# Plano: Excluir duplicados da contagem de limite/dia

## Problema raiz
A função `countsAsSuccessfulContact` (linha 231) **não exclui** registros com `skipped_duplicate`. Quando o primeiro boleto de um CPF é processado e os demais são marcados como duplicados, esses registros duplicados contam como "envio bem-sucedido" no `phoneSendCount` (linha 600-608). Como boletos do mesmo CPF geralmente têm o mesmo telefone, a contagem infla e bloqueia o envio legítimo — o próprio primeiro boleto ou boletos de outros CPFs no mesmo telefone caem em `skipped_phone_limit`.

## Correção — 1 linha
**Arquivo:** `deploy/backend/src/routes/followup-daily.ts` (linha 232)

De:
```typescript
return !notes || (!notes.startsWith("failed_api") && !notes.startsWith("skipped_phone_limit") && !notes.startsWith("skipped_invalid_phone"));
```

Para:
```typescript
return !notes || (!notes.startsWith("failed_api") && !notes.startsWith("skipped_phone_limit") && !notes.startsWith("skipped_invalid_phone") && !notes.startsWith("skipped_duplicate"));
```

## Por que isso resolve
- `buildPhoneSendCount` usa `countsAsSuccessfulContact` para somar envios por telefone
- Registros `skipped_duplicate` deixam de contar como envio
- Boletos pendentes legítimos param de ser bloqueados pelo limite/dia
- A lógica de `skipped_phone_limit` continua funcionando normalmente — não é tocada

## Após deploy
```bash
cd /root/deploy && docker compose up -d --build backend
```
Depois rodar o follow-up manualmente para confirmar que os pendentes entram na fila.

