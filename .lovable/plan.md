

# Plano: Corrigir inconsistências no monitoramento de grupos

## 3 problemas encontrados

### 1. `participant_jid` está salvando objeto JSON inteiro em vez de só o número
A Evolution API v2 envia `participants` como array de **objetos** `{id, phoneNumber, admin}`, não strings. O webhook trata como string (`p: string`) e grava o JSON inteiro no banco.

**Exemplo no banco:**
```
{"id":"48108381708350@lid","phoneNumber":"557199656380@s.whatsapp.net","admin":null}
```

**Deveria ser:** `557199656380` (número limpo)

### 2. Eventos duplicados (cada evento aparece 2x)
A Evolution API provavelmente envia o mesmo webhook 2 vezes (uma para `group-participants.update` e outra variação), ou o webhook está registrado em duplicidade. Cada participante tem 2 linhas com milissegundos de diferença.

### 3. Tabela `group_daily_stats` não existe na VPS
O código do webhook tenta inserir nela mas falha silenciosamente (erro 500 interno que não impede a resposta). A tabela nunca foi criada no `init-db.sql`.

## Impacto combinado

- **Contadores inflados**: cada entrada conta 2x (duplicação) → 147 "adds" no banco quando são ~73 reais
- **member_count errado**: `participants.length` conta corretamente (1 por objeto), mas a duplicação do webhook dobra o incremento. Ex: 1 pessoa entra → member_count sobe 2.
- **Feed ilegível**: `participant_jid` mostra JSON em vez do número

## Correções

### Arquivo: `deploy/backend/src/routes/groups-webhook.ts`

**A. Extrair número limpo do participant:**
```typescript
// Cada participant pode ser string OU objeto {id, phoneNumber}
function extractPhone(p: any): string {
  if (typeof p === "string") return p.replace(/@.*/, "").replace(/\D/g, "");
  const raw = p.phoneNumber || p.id || "";
  return raw.replace(/@.*/, "").replace(/\D/g, "");
}
```

**B. Deduplicar por participant + group_jid:**
Antes de inserir, verificar se já existe um evento idêntico nos últimos 60 segundos para evitar duplicação.

**C. Usar números limpos nos rows:**
```typescript
const cleanParticipants = participants.map(extractPhone).filter(Boolean);
// Deduplica dentro do mesmo payload
const uniqueParticipants = [...new Set(cleanParticipants)];
```

**D. Deduplicação temporal no banco** (evitar webhook duplicado):
```typescript
// Para cada participante, checar se já existe evento nos últimos 60s
const cutoff = new Date(Date.now() - 60_000).toISOString();
const { data: recent } = await sb
  .from("group_participant_events")
  .select("participant_jid")
  .eq("workspace_id", inst.workspace_id)
  .eq("group_jid", groupJid)
  .eq("action", action)
  .gte("created_at", cutoff);

const recentSet = new Set((recent || []).map(r => r.participant_jid));
const newParticipants = uniqueParticipants.filter(p => !recentSet.has(p));
```

Usar `newParticipants.length` para o incremento de `member_count` em vez de `participants.length`.

### Arquivo: `deploy/init-db.sql` — criar tabela `group_daily_stats`

```sql
CREATE TABLE IF NOT EXISTS public.group_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  group_jid text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  date date NOT NULL,
  additions integer NOT NULL DEFAULT 0,
  removals integer NOT NULL DEFAULT 0,
  total_members integer NOT NULL DEFAULT 0,
  UNIQUE(workspace_id, group_jid, date)
);
GRANT ALL ON public.group_daily_stats TO anon, authenticated, service_role;
```

### Arquivo: `deploy/migrate-workspace.sql` — registrar nova tabela

Adicionar `'group_daily_stats'` nos arrays de tabelas.

### Limpeza de dados existentes (SQL para rodar na VPS)

```sql
-- Limpar participant_jid que são JSON (extrair phoneNumber)
UPDATE group_participant_events
SET participant_jid = regexp_replace(
  (participant_jid::jsonb->>'phoneNumber'), '@.*', ''
)
WHERE participant_jid LIKE '{%';

-- Remover duplicatas (manter apenas o mais antigo)
DELETE FROM group_participant_events a
USING group_participant_events b
WHERE a.id > b.id
  AND a.workspace_id = b.workspace_id
  AND a.group_jid = b.group_jid
  AND a.participant_jid = b.participant_jid
  AND a.action = b.action
  AND a.created_at BETWEEN b.created_at - interval '2 minutes' AND b.created_at + interval '2 minutes';
```

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/groups-webhook.ts` | Extrair phone, deduplicar, usar contagem correta |
| `deploy/init-db.sql` | Criar tabela `group_daily_stats` |
| `deploy/migrate-workspace.sql` | Registrar `group_daily_stats` |

## Deploy + Limpeza

```bash
cd ~/simplificandoconversas && git pull && cd deploy

# 1. Criar tabela que falta
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
CREATE TABLE IF NOT EXISTS public.group_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  group_jid text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  date date NOT NULL,
  additions integer NOT NULL DEFAULT 0,
  removals integer NOT NULL DEFAULT 0,
  total_members integer NOT NULL DEFAULT 0,
  UNIQUE(workspace_id, group_jid, date)
);
GRANT ALL ON public.group_daily_stats TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
"

# 2. Limpar dados corrompidos
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
UPDATE group_participant_events
SET participant_jid = regexp_replace((participant_jid::jsonb->>'phoneNumber'), '@.*', '')
WHERE participant_jid LIKE '{%';
"

# 3. Remover duplicatas
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
DELETE FROM group_participant_events a
USING group_participant_events b
WHERE a.id > b.id
  AND a.workspace_id = b.workspace_id
  AND a.group_jid = b.group_jid
  AND a.participant_jid = b.participant_jid
  AND a.action = b.action
  AND a.created_at BETWEEN b.created_at - interval '2 minutes' AND b.created_at + interval '2 minutes';
"

# 4. Rebuild backend
docker compose up -d --build backend
```

