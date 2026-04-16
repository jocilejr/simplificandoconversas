

# Plano: Corrigir contagens e reconciliar member_count

## Problemas restantes

### 1. `member_count` nunca foi reconciliado com a Evolution API
Os logs não mostram "real member count" — o backend provavelmente não foi reconstruído com o código novo, ou nenhum evento chegou desde o rebuild. Os valores atuais (ex: #16=24 quando deveria ser ~14) são resíduos do incremento duplicado anterior.

### 2. Contadores "Entraram/Saíram" contam eventos de grupos NÃO monitorados
O hook `useGroupEvents` busca TODOS os eventos do workspace, incluindo os 6 grupos órfãos (99 eventos). Isso infla os totais no dashboard.

### 3. Feed de eventos mostra grupos não monitorados
O mesmo problema — eventos de grupos que não estão em `group_selected` aparecem no feed.

## Correções

### A. Frontend: Filtrar eventos apenas de grupos monitorados

**Arquivo: `src/hooks/useGroupEvents.ts`**

Adicionar filtro `.in("group_jid", selectedGroupJids)` nas queries de eventos e contadores. Como o hook não tem acesso direto aos grupos selecionados, receber os JIDs como parâmetro ou fazer um JOIN via query.

Abordagem mais simples: buscar os JIDs dos grupos monitorados primeiro, depois filtrar:

```typescript
// Na query de eventos, adicionar:
.in("group_jid", monitoredJids)
```

**Arquivo: `src/components/grupos/GroupDashboardTab.tsx`**

Passar os JIDs monitorados para o hook, ou filtrar no componente.

### B. VPS: Forçar reconciliação dos member_count

Rodar na VPS um comando que reconstrua o backend e depois force a atualização:

```bash
# 1. Rebuild backend com código de reconciliação
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend

# 2. Resetar member_count dos grupos novos para valor correto baseado nos eventos
# (temporário até a reconciliação via API funcionar)
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
UPDATE group_selected gs SET member_count = sub.net FROM (
  SELECT group_jid, workspace_id,
    GREATEST(0, SUM(CASE WHEN action='add' THEN 1 ELSE 0 END) - SUM(CASE WHEN action='remove' THEN 1 ELSE 0 END)) as net
  FROM group_participant_events
  GROUP BY group_jid, workspace_id
) sub
WHERE gs.group_jid = sub.group_jid AND gs.workspace_id = sub.workspace_id
AND gs.group_name LIKE '%#1_' OR gs.group_name LIKE '%#2_';
"
```

### C. Limpar eventos de grupos não monitorados

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
DELETE FROM group_participant_events e
WHERE NOT EXISTS (
  SELECT 1 FROM group_selected gs
  WHERE gs.group_jid = e.group_jid AND gs.workspace_id = e.workspace_id
);
"
```

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useGroupEvents.ts` | Filtrar eventos apenas de grupos monitorados |
| `src/components/grupos/GroupDashboardTab.tsx` | Passar JIDs monitorados ao hook |

## Resultado esperado

- Contadores "Entraram/Saíram" mostram apenas eventos de grupos monitorados
- Feed mostra apenas eventos relevantes
- `member_count` corrigido via SQL e reconciliado automaticamente via Evolution API nos próximos eventos

