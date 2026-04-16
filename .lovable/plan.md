

# Plano: Garantir sync do scheduler ao ativar campanha

## Diagnóstico real

O código no PUT `/campaigns/:id` tem uma guarda `wasActive !== nowActive` (linha 848). Se a campanha **já está ativa** no banco e o usuário clica no toggle (que já está ON), `wasActive = true` e `nowActive = true` → nenhum sync acontece. Também, se o backend reiniciou e o `loadAll` carregou os timers, mas algum timer falhou ou a mensagem não estava com `is_active = true`, o toggle não re-sincroniza porque o estado não mudou.

Além disso, `loadAll` carrega mensagens de **todas** as campanhas (inclusive inativas), desperdiçando timers que serão cancelados em `fireMessage`.

## Correções

### 1. `deploy/backend/src/routes/groups-api.ts` — Sync idempotente

Remover a guarda `wasActive !== nowActive`. Sempre que o PUT receber `isActive`, sincronizar os timers de forma idempotente:

- Se `isActive === true` → para cada mensagem ativa da campanha, garantir que existe timer (se já existe, recria)
- Se `isActive === false` → cancelar todos os timers
- Adicionar log de entrada no PUT handler: `[groups-api] PUT /campaigns/:id isActive=X wasActive=Y`

```typescript
// Substituir a guarda wasActive !== nowActive por:
if (isActive !== undefined) {
  const { data: msgs } = await sb
    .from("group_scheduled_messages")
    .select(...)
    .eq("campaign_id", req.params.id)
    .eq("is_active", true);

  if (nowActive) {
    // Sempre garantir timers (idempotente)
    for (const m of msgs) { ... scheduleMessage ... }
  } else {
    // Sempre cancelar
    for (const m of msgs) { groupScheduler.cancelMessage(m.id); }
  }
}
```

### 2. `deploy/backend/src/lib/group-scheduler.ts` — `loadAll` filtra por campanha ativa

Após carregar as mensagens ativas, buscar quais campanhas estão ativas e filtrar:

```typescript
const campaignIds = [...new Set(messages.map(m => m.campaign_id))];
const { data: activeCampaigns } = await sb
  .from("group_campaigns")
  .select("id")
  .in("id", campaignIds)
  .eq("is_active", true);

const activeSet = new Set(activeCampaigns?.map(c => c.id) || []);
const validMessages = messages.filter(m => activeSet.has(m.campaign_id));
```

### 3. Log de entrada no PUT

Adicionar no início do handler:
```typescript
console.log(`[groups-api] PUT /campaigns/${req.params.id} body:`, JSON.stringify(req.body));
```

## Resultado
- Toggle ON sempre sincroniza timers, mesmo que a campanha já estivesse ativa
- Toggle OFF sempre cancela timers
- `loadAll` não carrega timers de campanhas inativas
- Logs detalhados para diagnosticar qualquer problema futuro

## Validação pós-deploy
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

Ative uma campanha e verifique:
```bash
docker logs deploy-backend-1 --since=2m 2>&1 | grep -i "\[groups-api\]\|\[scheduler\]" | tail -30
```

