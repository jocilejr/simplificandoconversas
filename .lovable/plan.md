

# Plano: Filtrar mensagens de campanhas inativas na visão geral

## Problema
O endpoint `scheduler-debug` no backend só filtra campanhas inativas para ranges futuros (`tomorrow`, `week`, `all`). Quando o range é `today` (padrão da visão geral), mensagens de campanhas desativadas continuam aparecendo.

## Correção

### Backend — `deploy/backend/src/routes/groups-api.ts`
Linha ~2285: remover a condição `isFutureRange` e **sempre** filtrar mensagens de campanhas inativas, independente do range selecionado.

**De:**
```typescript
const filteredMessages = isFutureRange
  ? todayMessages.filter((m: any) => {
      const campaign = campaignMap[m.campaign_id];
      if (!campaign) return true;
      return campaign.is_active;
    })
  : todayMessages;
```

**Para:**
```typescript
const filteredMessages = todayMessages.filter((m: any) => {
  const campaign = campaignMap[m.campaign_id];
  if (!campaign) return true;
  return campaign.is_active;
});
```

Após deploy na VPS:
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

