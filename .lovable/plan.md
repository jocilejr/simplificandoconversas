

## Plano Revisado: Detecção de grupos banidos com verificação de status da instância + contagem em tempo real

### Lógica correta

O redirecionamento **já filtra** por `g.invite_url` (linha 1021). O problema é que quando o sync falha (seja por instância offline ou grupo banido), ele simplesmente **não atualiza** a `invite_url` — mas também não a remove. Então um grupo banido continua com a URL antiga (quebrada).

A solução correta:
- **Instância offline** → não mexer nos grupos, registrar erro
- **Instância online + inviteCode falhou** → marcar `status: "banned"`, limpar `invite_url`
- **Instância online + inviteCode OK** → marcar `status: "active"`, atualizar URL
- **Redirect** → filtrar `status !== "banned"` (redundante com `invite_url` vazia, mas defesa dupla)

### Mudanças

#### 1. `deploy/backend/src/routes/groups-api.ts` — `sync-all` (linha ~1110)

Antes de iterar os grupos de cada Smart Link, verificar o `connectionState` da instância:

```text
GET /instance/connectionState/{instanceName}
  → status !== "open":
    - last_sync_error = "Instância desconectada (status: close)"
    - NÃO altera status/invite_url dos grupos
    - Pula para o próximo Smart Link

  → status === "open":
    - Para cada grupo:
      - inviteCode OK → gl.status = "active", invite_url atualizada
      - inviteCode ERRO → gl.status = "banned", gl.invite_url = ""
```

#### 2. `deploy/backend/src/routes/groups-api.ts` — `smart-link-redirect` (linha ~1020)

Adicionar filtro de `status !== "banned"`:
```typescript
const available = groupLinks
  .filter((g) => g.invite_url && g.status !== "banned" && (g.member_count || 0) < maxMembers)
```

E no fallback round-robin (linha ~1031):
```typescript
const withUrl = groupLinks.filter((g) => g.invite_url && g.status !== "banned");
```

#### 3. `deploy/backend/src/routes/groups-webhook.ts` — Atualizar `member_count` no Smart Link JSONB

Após atualizar `group_selected.member_count`, buscar todos os `group_smart_links` ativos que contêm aquele `group_jid` no JSONB e atualizar o `member_count` correspondente. Isso garante contagem em tempo real no Smart Link.

#### 4. `deploy/backend/src/index.ts` — Cron `*/5` → `*/15`

#### 5. `src/hooks/useGroupSmartLinks.ts` — `refetchInterval: 15000`

Polling a cada 15s nas queries de smart links e stats.

#### 6. `src/components/grupos/GroupSmartLinkTab.tsx` — Badge visual

- Badge verde "Ativo" / vermelho "Banido" na tabela de grupos
- Alerta amarelo no card se `last_sync_error` contiver "desconectada"

### Arquivos

| Arquivo | Ação |
|---------|------|
| `deploy/backend/src/routes/groups-api.ts` | Checar connectionState no sync; marcar banned/active; filtrar no redirect |
| `deploy/backend/src/routes/groups-webhook.ts` | Atualizar member_count no JSONB do Smart Link |
| `deploy/backend/src/index.ts` | Cron `*/5` → `*/15` |
| `src/hooks/useGroupSmartLinks.ts` | `refetchInterval: 15000` |
| `src/components/grupos/GroupSmartLinkTab.tsx` | Badge banned/ativo + alerta instância inativa |

### Fluxo

```text
Cron 15min → sync-all
  ├─ GET connectionState
  │   ├─ OFFLINE → last_sync_error, não altera grupos
  │   └─ ONLINE → para cada grupo:
  │       ├─ inviteCode OK  → status="active", invite_url OK
  │       └─ inviteCode ERR → status="banned", invite_url=""
  │
Webhook participante → groups-webhook.ts
  └─ Atualiza member_count em group_selected (já existe)
  └─ Atualiza member_count no JSONB de group_smart_links (NOVO)

Redirect
  └─ Filtra: invite_url presente + status !== "banned" + member_count < max
```

