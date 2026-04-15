

# Plano: Sync incremental + indicador visual em tempo real

## Problema
1. O backend salva `group_links` no DB **apenas no final** do loop. Se o refetch do frontend ocorre antes da escrita final, os últimos grupos aparecem sem URL.
2. Não há indicador visual de qual grupo está sendo sincronizado.

## Solução

### 1. `deploy/backend/src/routes/groups-api.ts` — sync-invite (linhas 1546-1622)
- **Salvar no DB após CADA grupo** (não só no final). Mover o `sb.from("group_smart_links").update({ group_links })` para dentro do loop, após processar cada grupo.
- Adicionar campo temporário `sync_progress` (JSON) no update: `{ current: i+1, total: groupLinks.length, currentJid: gl.group_jid }` — permite o frontend saber qual grupo está sendo processado.
- Manter o update final com `last_successful_sync_at` e reset de erros.

### 2. `src/hooks/useGroupSmartLinks.ts` — SmartLink interface + hook
- Adicionar `sync_progress` ao tipo `SmartLink`: `sync_progress: { current: number; total: number; currentJid: string } | null`
- No `syncInviteLinks.onSuccess`: setar `sync_progress: null` via `queryClient.setQueryData` para limpar o progresso imediatamente.

### 3. `src/components/grupos/GroupSmartLinkTab.tsx` — indicador visual
- Na tabela de grupos, quando `smartLink.sync_progress?.currentJid === gl.group_jid`: mostrar spinner animado (ícone `RefreshCw` com `animate-spin`) na linha do grupo.
- Grupos já processados (index < current): mostrar check verde temporário.
- Grupos pendentes (index > current): manter visual normal.
- Header: mostrar progresso "Sincronizando 5/15..." ao lado do botão.
- Aumentar `refetchInterval` para **3 segundos** enquanto `sync_progress` não for null (via lógica condicional no hook ou no componente).

### 4. Nenhuma migração de DB necessária
O campo `sync_progress` será armazenado como JSONB dentro da coluna existente ou como coluna adicional. Como `group_smart_links` já tem estrutura flexível, vou usar uma coluna nova `sync_progress jsonb default null` — precisa de uma migration simples.

**Correção**: Na verdade, posso evitar a migration usando o campo `last_sync_error` temporariamente ou adicionando ao JSON do `group_links`. Melhor: adicionar coluna `sync_progress` via migration.

### Resumo das alterações
| Arquivo | O quê |
|---------|-------|
| `deploy/backend/src/routes/groups-api.ts` | Save incremental + write `sync_progress` a cada iteração, limpar no final |
| `src/hooks/useGroupSmartLinks.ts` | Tipo `sync_progress`, refetchInterval dinâmico (3s quando syncing) |
| `src/components/grupos/GroupSmartLinkTab.tsx` | Spinner no grupo atual, check nos processados, "Sincronizando X/Y" no header |
| Migration SQL | `ALTER TABLE group_smart_links ADD COLUMN sync_progress jsonb DEFAULT NULL` |

### Deploy
```bash
cd /root/simplificandoconversas/deploy && docker compose up -d --build backend
```
E rodar a migration na VPS:
```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "ALTER TABLE group_smart_links ADD COLUMN IF NOT EXISTS sync_progress jsonb DEFAULT NULL;"
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
```

