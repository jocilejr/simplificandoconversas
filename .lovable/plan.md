

## Plano: Redirect Instantâneo + Sync Separado

### Problema Atual
O `SmartLinkRedirect.tsx` faz um `fetch()` ao backend, espera JSON, depois faz `window.location.href`. Isso adiciona delay desnecessário. Além disso, o plano anterior propunha fazer fetch na Evolution API durante o redirect, o que pioraria o delay.

### Arquitetura Correta

```text
PÚBLICO (instantâneo):
  /r/g/slug → Nginx 302 → Backend lê tabela → redirect 302

INTERNO (separado, periódico):
  Cron/botão sync → Evolution API → atualiza group_links na tabela
```

### Mudanças

#### 1. Redirect (`groups-api.ts` — rota `smart-link-redirect`)
Manter como está: lê `group_smart_links` do DB, filtra grupos com `invite_url` e `member_count < max`, redireciona para o com menos membros. **Nenhuma chamada à Evolution API aqui.**

Adicionar **fallback round-robin**: se todos os grupos estão "lotados" (member_count >= max), em vez de retornar erro 404, distribui round-robin entre TODOS os `invite_url` armazenados. Incrementa `current_group_index` no banco.

Lógica:
1. Busca smart link ativo pelo slug
2. Filtra grupos disponíveis (member_count < max e invite_url preenchido)
3. Se há grupos disponíveis → redireciona para o com menos membros (regra principal)
4. Se NENHUM disponível → pega todos que têm invite_url → round-robin via `current_group_index`
5. Se nenhum tem invite_url → retorna erro

#### 2. Sync automático — nova rota cron (`groups-api.ts`)
Criar rota `POST /smart-links/sync-all` chamada por cron (a cada 5 min, configurável):
- Para cada smart link ativo, busca member_count real e invite_url via Evolution API
- Atualiza `group_links` JSON na tabela
- Registra `last_successful_sync_at` ou `last_sync_error` / `last_sync_error_at`

#### 3. Migração SQL — colunas de status
Adicionar na tabela `group_smart_links`:
- `last_sync_error` (text, nullable)
- `last_sync_error_at` (timestamptz, nullable)
- `last_successful_sync_at` (timestamptz, nullable)

#### 4. Frontend — banner de erro no detalhe (`GroupSmartLinkTab.tsx`)
Se `last_sync_error` existe, mostrar alerta amarelo: "Problema na sincronização com a instância. O sistema está distribuindo links em rodízio."

#### 5. `SmartLinkRedirect.tsx` — simplificar
Na VPS o Nginx resolve direto. Manter a página apenas como fallback para ambientes sem Nginx (preview), mas trocar o fetch por um redirect direto ao endpoint do backend (como já faz o `LinkRedirect.tsx`).

### Arquivos

| Arquivo | Ação |
|---------|------|
| `deploy/backend/src/routes/groups-api.ts` | Alterar redirect (fallback round-robin) + nova rota sync-all |
| `src/components/grupos/GroupSmartLinkTab.tsx` | Banner de erro de sync |
| `src/pages/SmartLinkRedirect.tsx` | Simplificar para redirect direto |

### Na VPS após deploy
```bash
# Adicionar colunas
docker exec -i deploy-postgres-1 psql -U postgres -d postgres -c "
ALTER TABLE public.group_smart_links ADD COLUMN IF NOT EXISTS last_sync_error text;
ALTER TABLE public.group_smart_links ADD COLUMN IF NOT EXISTS last_sync_error_at timestamptz;
ALTER TABLE public.group_smart_links ADD COLUMN IF NOT EXISTS last_successful_sync_at timestamptz;
"

# Rebuild backend
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend

# Opcional: adicionar cron para sync automático (a cada 5 min)
# crontab -e → */5 * * * * curl -s http://localhost:3001/api/groups/smart-links/sync-all
```

