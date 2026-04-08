
# Filtrar apenas grupos reais no fetch-groups

## Problema

O endpoint `POST /fetch-groups` chama `fetchAllGroups` da Evolution API, que retorna **todos os JIDs** — incluindo contatos individuais (`@s.whatsapp.net`). Esses contatos aparecem como "Sem nome" na lista de grupos porque não possuem `subject`.

## Correção

**Arquivo**: `deploy/backend/src/routes/groups-api.ts` (linhas 52-58)

Adicionar filtro para manter apenas JIDs que terminam com `@g.us` (padrão de grupo WhatsApp):

```ts
const raw: any = await resp.json();
const list = Array.isArray(raw) ? raw : (raw?.groups || []);
const groups = list
  .filter((g: any) => {
    const jid = g.id || g.jid || g.groupJid || "";
    return jid.endsWith("@g.us");
  })
  .map((g: any) => ({
    jid: g.id || g.jid || g.groupJid,
    name: g.subject || g.name || "Sem nome",
    memberCount: g.participants?.length || g.size || 0,
  }));
```

Apenas 1 linha lógica adicionada (`.filter`). Nenhuma outra alteração necessária.

### Após deploy na VPS:
```bash
docker compose up -d --build backend
```
