

# Plano: Acelerar fetch de grupos e mostrar todos

## Problema
O endpoint `POST /fetch-groups` faz uma chamada sequencial `findGroupInfos` para **cada grupo** individualmente (linha 676). Com 50+ grupos, isso leva minutos e causa timeouts. Além disso, grupos são descartados se o `findGroupInfos` falhar ou se o owner não for encontrado nos participantes.

## Causa raiz
```
fetchAllGroups → loop sobre cada grupo → findGroupInfos (1 request por grupo, sequencial)
```
Se a instância tem 100 grupos, são 100+ requests HTTP sequenciais à Evolution API.

## Solução
Usar os dados já retornados pelo `fetchAllGroups` sem chamar `findGroupInfos` para cada grupo. O `fetchAllGroups` já retorna nome e tamanho. A validação de owner é desnecessária para listar grupos disponíveis — o usuário decide o que monitorar.

### Alteração em `deploy/backend/src/routes/groups-api.ts` (linhas 656-719)

Substituir o loop com `findGroupInfos` por mapeamento direto:

```typescript
const groups = gusOnly.map((g: any) => {
  const jid = g.id || g.jid || g.groupJid || "";
  const name = g.subject || g.name || "Sem nome";
  const memberCount = g.size || g.participants?.length || 0;
  return { jid, name, memberCount };
});

console.log(`[groups-api] Total groups returned: ${groups.length} (from ${list.length} raw)`);
res.json(groups);
```

## Resultado
- Fetch de grupos passa de ~30-60s para ~1-2s (uma única chamada à Evolution API)
- **Todos** os grupos `@g.us` da instância são listados
- Nenhuma validação de owner ou participantes — o usuário escolhe o que monitorar
- A validação real de participação continua sendo feita no envio de campanhas (que já usa `findGroupInfos`)

## Arquivo modificado
- `deploy/backend/src/routes/groups-api.ts` — simplificar `POST /fetch-groups`

## Após deploy
```bash
cd /root/deploy && docker compose up -d --build backend
```

