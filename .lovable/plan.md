

## Diagnóstico

Os logs mostram apenas `Backend running on port 3001` e `[check-timeouts] Fetch error: {}`. Nenhum log de sync-chats ou delete aparece, o que confirma que **o container está rodando código antigo** — o Docker BuildKit usa cache baseado em conteúdo e o `./update.sh` não força `--no-cache`.

A instância "Teste" está conectada, então o sync deveria funcionar. O delete também deveria limpar o banco. Ambos falham silenciosamente porque o código no container não é o atual.

## Plano

### 1. Corrigir `deploy/update.sh` — forçar rebuild sem cache do backend

Linha 47, trocar `docker compose build` por:

```bash
docker compose build --no-cache backend
docker compose build
```

### 2. Adicionar logs de debug no backend (`deploy/backend/src/routes/whatsapp-proxy.ts`)

No `sync-chats` (após linha 225):
```typescript
console.log(`[sync-chats] Instances to sync: ${JSON.stringify(instancesToSync)}`);
```

Dentro do loop (após linha 234):
```typescript
console.log(`[sync-chats] ${instName}: connectionState=${connectionState}`);
```

Após findChats (após linha 245):
```typescript
console.log(`[sync-chats] ${instName}: ${Array.isArray(chats) ? chats.length : 'not-array'} chats returned`);
```

No `delete-instance` (após linha 146):
```typescript
console.log(`[delete-instance] Deleting: ${delInstName} for user ${userId}`);
```

Após cleanup do DB (após linha 156):
```typescript
console.log(`[delete-instance] DB cleanup done for ${delInstName}`);
```

### 3. Melhorar feedback do sync no frontend (`src/pages/Conversations.tsx`)

No `onSuccess` do `syncChats`, mostrar estado das instâncias quando 0 conversas:

```typescript
onSuccess: (data) => {
  queryClient.invalidateQueries({ queryKey: ["conversations"] });
  if (data?.info) {
    toast({ title: "Informação", description: data.info });
  } else if (data?.synced > 0) {
    toast({ title: "Sincronizado", description: `${data.synced} conversas sincronizadas` });
  } else {
    const statuses = data?.instanceStatuses || [];
    const disconnected = statuses.filter((s) => s.connectionState !== "open");
    if (statuses.length === 0) {
      toast({ title: "Nenhuma instância", description: "Conecte uma instância em Configurações.", variant: "destructive" });
    } else if (disconnected.length === statuses.length) {
      toast({ title: "Instâncias desconectadas", description: "Reconecte via QR Code.", variant: "destructive" });
    } else {
      toast({ title: "Sincronizado", description: "0 conversas encontradas nas instâncias conectadas" });
    }
  }
}
```

### 4. Deploy na VPS

Após aplicar, executar:
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose build --no-cache backend && docker compose up -d backend
docker compose logs backend --tail=30 -f
```

Depois clicar em Sincronizar e verificar os logs para entender exatamente o que a Evolution API retorna.

