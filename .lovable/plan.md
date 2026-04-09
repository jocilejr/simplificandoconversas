

# Remover cron do light-sync

## Contexto

O light-sync roda automaticamente a cada 5 minutos via cron mas nunca foi útil. O botão "Sincronizar" já existente nas instâncias faz um sync muito mais completo (`sync-chats`) que já importa conversas E mensagens. O light-sync manual via `debug-lightsync` também continua disponível se necessário.

## Alteração

### `deploy/backend/src/index.ts`

Remover (ou comentar) o bloco do cron de light-sync (linhas ~78-85):

```typescript
// REMOVER:
cron.schedule("*/5 * * * *", async () => {
  try {
    await lightSync();
  } catch (err: any) {
    console.error("[cron] light-sync error:", err.message);
  }
});
```

Remover também o import do `lightSync` (linha 13), já que ele continuará disponível apenas via a action `debug-lightsync` no `whatsapp-proxy.ts` (que já importa diretamente).

Nenhuma outra alteração necessária — o botão "Sincronizar" já funciona com `sync-chats` e é mais completo que o light-sync.

