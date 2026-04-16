

# Plano: Corrigir member_count e group_name nos eventos de grupos

## Problemas

### 1. `member_count` acumula drift e nunca se auto-corrige
O webhook incrementa/decrementa `member_count` por evento, mas com duplicações anteriores e possíveis webhooks perdidos, o número fica desatualizado (ex: mostra 20 quando são 14). Não existe mecanismo de reconciliação.

### 2. Eventos de saída sem `group_name`
No webhook, a busca por `group_name` usa `group_selected`, mas se não encontra (ex: grupo removido ou JID diferente), grava `group_name: ""`. No feed de eventos, aparece só o JID sem nome legível.

## Correções

### A. Sincronizar `member_count` com a Evolution API (reconciliação real)

**Arquivo: `deploy/backend/src/routes/groups-webhook.ts`**

Após processar o evento, buscar o count real do grupo via Evolution API (`findGroupInfos`) e usar esse valor em vez do incremento relativo:

```typescript
// Após inserir os eventos, buscar contagem real
try {
  const { baseUrl, apiKey } = getEvolutionConfig(inst);
  const resp = await fetch(`${baseUrl}/group/findGroupInfos/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ groupJid }),
  });
  if (resp.ok) {
    const info = await resp.json();
    const realCount = info.participants?.length || info.size || 0;
    await sb.from("group_selected")
      .update({ member_count: realCount })
      .eq("workspace_id", inst.workspace_id)
      .eq("group_jid", groupJid);
  }
} catch (e) {
  // fallback: manter o incremento relativo
}
```

Isso garante que a cada evento de entrada/saída, o `member_count` é reconciliado com o valor real.

### B. Resolver `group_name` com fallback

**Arquivo: `deploy/backend/src/routes/groups-webhook.ts`**

Se `group_selected` não retornar nome, usar o campo `subject` do payload do webhook (que a Evolution API envia):

```typescript
const groupName = sg?.group_name || data.subject || data.groupName || "";
```

### C. Importar config da Evolution API no webhook

O webhook precisa acessar `getEvolutionConfig` para buscar o count real. Precisa importar ou duplicar o helper que já existe em `groups-api.ts`.

Opção mais limpa: extrair `getEvolutionConfig` para um helper compartilhado, ou copiar a lógica inline no webhook.

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/groups-webhook.ts` | Reconciliar member_count via API real + fallback group_name |

## Verificação na VPS

```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend

# Verificar se member_count está correto após próximo evento
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT group_name, member_count FROM group_selected ORDER BY group_name;
"

# Forçar reconciliação: remover e re-adicionar os grupos na aba Selecionar
# Isso vai buscar o memberCount real da API e sobrescrever
```

## Resultado esperado

- `member_count` sempre reflete a contagem real de participantes (via API)
- Eventos de saída mostram o nome do grupo corretamente
- Sem drift acumulativo — cada webhook reconcilia o valor

