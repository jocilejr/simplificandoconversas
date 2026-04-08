

# Filtrar apenas grupos ativos onde o usuário participa

## Problema

O endpoint `fetchAllGroups` da Evolution API retorna **todos os grupos do histórico** da instância, incluindo grupos que o usuário já saiu ou foi removido. Isso polui a lista com grupos inativos.

## Solução

Trocar o endpoint de `fetchAllGroups` para uma abordagem que valide participação ativa. A Evolution API v2 possui o endpoint `fetchAllGroups` que retorna `participants` — basta filtrar apenas os grupos onde o número da instância está presente na lista de participantes.

### Arquivo: `deploy/backend/src/routes/groups-api.ts`

No handler `POST /fetch-groups`, após o filtro `@g.us`, adicionar um segundo filtro que verifica se o número da instância está na lista de `participants` do grupo:

1. Buscar o número da instância via endpoint `/instance/fetchInstances` ou extrair do `instanceName`
2. Filtrar `list` para manter apenas grupos onde `participants` contém o JID da instância
3. Resultado: apenas grupos ativos onde o usuário pode enviar mensagens

```ts
// Após obter a lista raw, buscar o JID da instância
const instResp = await fetch(`${baseUrl}/instance/fetchInstances`, {
  headers: { apikey: apiKey },
});
const instances = await instResp.json();
const thisInst = instances?.find((i: any) => i.instance?.instanceName === instanceName);
const ownerJid = thisInst?.instance?.owner || "";

// Filtrar grupos onde o owner está nos participants
const groups = list
  .filter((g: any) => {
    const jid = g.id || g.jid || g.groupJid || "";
    if (!jid.endsWith("@g.us")) return false;
    // Verificar se o dono da instância está nos participantes
    const participants = g.participants || [];
    if (participants.length === 0) return true; // sem dados de participantes, manter
    return participants.some((p: any) => {
      const pJid = p.id || p.jid || "";
      return pJid === ownerJid;
    });
  })
  .map((g: any) => ({
    jid: g.id || g.jid || g.groupJid,
    name: g.subject || g.name || "Sem nome",
    memberCount: g.participants?.length || g.size || 0,
  }));
```

### Arquivo alterado
1. `deploy/backend/src/routes/groups-api.ts` — adicionar filtro de participação ativa

### Após deploy na VPS
```bash
docker compose up -d --build backend
```

