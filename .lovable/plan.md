

# Plano: Adotar a arquitetura de sync do whats-grupos

## Problema raiz

O sistema atual tenta manter `member_count` via incrementos/decrementos no webhook. Isso gera drift inevitável (duplicações, webhooks perdidos, etc). O repositório de referência resolve isso com uma abordagem fundamentalmente diferente:

1. **`member_count` vem da API real** (sync), não de incrementos
2. **Contadores "Entraram/Saíram" vêm da contagem direta** de eventos em `group_participant_events`
3. **Sync automático** ao abrir a página

## Mudanças

### 1. Criar rota de sync no backend (`deploy/backend/src/routes/groups-api.ts`)

Adicionar endpoint `POST /api/groups/sync-stats` que:
- Busca todos os grupos da instância Evolution API via `findGroupInfos` ou `fetchAllGroups`
- Para cada grupo monitorado em `group_selected`, atualiza `member_count` com o valor real da API (`participants.length`)
- Retorna a contagem atualizada

Isso substitui o mecanismo de reconciliação atual no webhook (que nunca funcionou consistentemente).

### 2. Atualizar o frontend para usar sync automático

**`src/components/grupos/GroupDashboardTab.tsx`:**
- Adicionar `useMutation` que chama `POST /api/groups/sync-stats` ao montar o componente (auto-sync)
- Botão manual "Sincronizar" para forçar atualização
- Após sync, invalidar queries de `group-selected`

### 3. Simplificar o webhook (`deploy/backend/src/routes/groups-webhook.ts`)

- Remover toda a lógica de incremento/decremento de `member_count`
- Remover a chamada `fetchRealMemberCount` por evento (ineficiente)
- Manter apenas: inserir evento em `group_participant_events` + atualizar `group_daily_stats`
- O `member_count` será corrigido pelo sync, não pelo webhook

### 4. Manter a contagem de eventos como está (já funciona)

O `useGroupEvents` já conta add/remove corretamente a partir de `group_participant_events` filtrado por `monitoredJids`. Isso não muda.

## Detalhes técnicos

### Nova rota: `POST /api/groups/sync-stats`

```text
Request: { workspaceId }
1. Buscar instância ativa do workspace
2. Chamar Evolution API: GET /group/fetchAllGroups/{instanceName}
3. Para cada grupo retornado que exista em group_selected:
   - UPDATE group_selected SET member_count = real_count
4. Retornar { synced: N, groups: [...] }
```

### Frontend: auto-sync no mount

```text
GroupDashboardTab monta
  → chama POST /api/groups/sync-stats (uma vez)
  → invalida ["group-selected"]
  → member_count atualizado em todos os cards
```

### Webhook simplificado

```text
Evento chega → insere em group_participant_events → atualiza group_daily_stats
(NÃO toca em member_count — o sync cuida disso)
```

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/groups-api.ts` | Nova rota `sync-stats` |
| `deploy/backend/src/routes/groups-webhook.ts` | Remover lógica de member_count |
| `src/components/grupos/GroupDashboardTab.tsx` | Auto-sync + botão manual |

## Comandos VPS após deploy

```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

## Resultado esperado

- `member_count` sempre correto (vem direto da API)
- Contadores "Entraram/Saíram" corretos (contagem de eventos filtrados)
- Sem drift acumulativo
- Consistente com a lógica do repositório de referência

