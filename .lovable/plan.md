

# Investigar origem dos grupos fantasma

## Problema
A Evolution API está retornando grupos "Oração" e "Sem nome" via `fetchAllGroups` e `findGroupInfos`, mas esses grupos não existem de verdade. O filtro atual não consegue distinguir porque a própria API retorna dados para eles (incluindo participantes).

## Plano de investigação

### 1. Adicionar endpoint de diagnóstico no backend
Arquivo: `deploy/backend/src/routes/groups-api.ts`

Criar um `POST /debug-groups` que retorna o payload **bruto** de cada etapa, sem filtro nenhum, para você inspecionar na VPS:
- Resposta crua de `fetchAllGroups`
- Resposta crua de `findGroupInfos` para cada grupo
- Resposta crua de `fetchInstances` e `connectionState`

Assim você consegue ver exatamente o que a Evolution está devolvendo e identificar se o dado vem do cache dela, do Redis, ou do banco PostgreSQL da Evolution.

### 2. Comando para investigar na VPS

Depois do rebuild, você vai rodar:
```bash
curl -s -X POST http://localhost:3001/api/groups/debug-groups \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"Número das Entregas","workspaceId":"SEU_WORKSPACE_ID"}' | jq .
```

Isso vai mostrar:
- `rawFetchAllGroups`: lista completa que a Evolution retorna
- `rawFindGroupInfos`: detalhes de cada grupo candidato
- `rawInstanceInfo`: dados da instância (owner, wuid, etc.)

### 3. Possíveis causas e próximos passos

Dependendo do resultado:
- **Se `fetchAllGroups` retorna os grupos fantasma**: o problema é cache da Evolution (Redis ou banco). Solução: limpar cache ou usar endpoint alternativo
- **Se `findGroupInfos` retorna participants para grupo inexistente**: a Evolution está servindo dado stale do seu PostgreSQL interno. Solução: reiniciar Evolution ou limpar tabelas internas
- **Se os dados parecem legítimos**: talvez sejam grupos onde o número ainda está registrado mas foram arquivados

### Detalhes técnicos
- Arquivo alterado: `deploy/backend/src/routes/groups-api.ts`
- Novo endpoint temporário: `POST /debug-groups` (pode ser removido depois)
- Nenhuma alteração no frontend

