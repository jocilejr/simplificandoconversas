

## Diagnóstico revisado

Você está certo — o problema é mais grave que dedup. O webhook **não filtra por instância selecionada**. Hoje em `groups-webhook.ts:46-52`:

```ts
const { data: inst } = await sb
  .from("whatsapp_instances")
  .select("workspace_id, user_id")
  .eq("instance_name", instanceName)
  .maybeSingle();
if (!inst) return res.json({ ignored: true, reason: "instance not found" });
```

Só valida se a instância **existe no workspace** — não checa se ela está em `group_selected` para aquele grupo. Resultado: se "Número Backup dos Grupos" e "Número das Entregas 02" estão ambas no mesmo grupo, mas só uma foi selecionada para monitorar, **as duas inserem eventos** → duplica e polui.

A regra correta: **só processar evento se existir row em `group_selected` com `(workspace_id, instance_name, group_jid)` exato**. Toda instância não-selecionada para aquele grupo é descartada na origem.

## Correção

### Fix único em `deploy/backend/src/routes/groups-webhook.ts`
Após resolver a instância, antes de qualquer insert, validar:

```ts
const { data: monitored } = await sb
  .from("group_selected")
  .select("id")
  .eq("workspace_id", inst.workspace_id)
  .eq("instance_name", instanceName)
  .eq("group_jid", groupJid)
  .maybeSingle();

if (!monitored) {
  return res.json({ ignored: true, reason: "instance not selected for this group" });
}
```

Isso elimina:
- Duplicação por múltiplas instâncias no mesmo grupo (só a selecionada conta)
- Poluição de eventos de grupos não monitorados
- Race condition entre instâncias (só 1 instância insere por grupo)

### Complementos (mantidos do plano anterior, mas agora secundários)
1. **`extractPhone` blindado** — ainda necessário para limpar rows com JSON cru (`@lid`).
2. **UNIQUE INDEX no DB** — defesa extra contra retries da própria Evolution na mesma instância.
3. **Limpeza retroativa** — apagar rows existentes que vieram de instâncias não-selecionadas + duplicados.

### Regra de negócio: e se 2 instâncias forem selecionadas para o mesmo grupo?
Decisão: **a primeira a inserir no bucket de 5min ganha** (via UNIQUE INDEX). Não duplica contagem. Caso queira que o usuário escolha "instância oficial" por grupo, é feature futura.

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/groups-webhook.ts` | Validar `group_selected` antes de inserir + `extractPhone` blindado + `upsert(ignoreDuplicates)` |
| Migração SQL (VPS) | `dedup_bucket` + UNIQUE INDEX + DELETE retroativo de duplicados, JSON cru, e eventos de instâncias não-selecionadas |

## Comandos VPS pós-deploy

```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend

docker exec -i deploy-postgres-1 psql -U postgres -d postgres <<'SQL'
-- 1) Bucket de 5min para dedup defensivo
ALTER TABLE group_participant_events
  ADD COLUMN IF NOT EXISTS dedup_bucket timestamptz
  GENERATED ALWAYS AS (date_trunc('minute', created_at) - 
    (EXTRACT(MINUTE FROM created_at)::int % 5) * interval '1 minute') STORED;

-- 2) Apagar eventos de instâncias NÃO selecionadas para o grupo
DELETE FROM group_participant_events e
WHERE NOT EXISTS (
  SELECT 1 FROM group_selected s
  WHERE s.workspace_id = e.workspace_id
    AND s.instance_name = e.instance_name
    AND s.group_jid = e.group_jid
);

-- 3) Apagar duplicados restantes (mesma instância, mesmo evento, <5min)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY workspace_id, group_jid, action, participant_jid, dedup_bucket
    ORDER BY created_at
  ) AS rn FROM group_participant_events
)
DELETE FROM group_participant_events WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 4) Apagar rows com participant_jid inválido
DELETE FROM group_participant_events
WHERE participant_jid LIKE '{%' OR participant_jid LIKE '%@lid%' 
   OR length(regexp_replace(participant_jid, '\D', '', 'g')) NOT BETWEEN 10 AND 13;

-- 5) UNIQUE para barrar futuros duplicados na origem
CREATE UNIQUE INDEX IF NOT EXISTS group_participant_events_dedup_idx
  ON group_participant_events (workspace_id, group_jid, action, participant_jid, dedup_bucket);

NOTIFY pgrst, 'reload schema';
SQL
```

## Validação pós-fix
```bash
# Deve retornar 0
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT COUNT(*) AS eventos_de_instancia_nao_monitorada
FROM group_participant_events e
WHERE NOT EXISTS (
  SELECT 1 FROM group_selected s
  WHERE s.workspace_id=e.workspace_id 
    AND s.instance_name=e.instance_name 
    AND s.group_jid=e.group_jid
);"
```

