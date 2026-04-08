
Problema encontrado: o filtro novo não quebrou a busca de grupos; ele só expôs que a resolução do `ownerJid` está errada para a sua Evolution na VPS. Pelos logs:

```text
ownerJid resolved:
ownerJid: "", ownerNorm: ""
ownerJid not resolved — returning empty list
```

Ou seja: `fetchAllGroups` até está retornando grupos, mas `/instance/fetchInstances` não está entregando `instance.owner` nessa instalação. Então hoje o backend bloqueia tudo por segurança.

Plano de correção

1. Corrigir a origem do “dono da instância” no backend
- Arquivo: `deploy/backend/src/routes/groups-api.ts`
- Vou remover a dependência rígida de `fetchInstances` para descobrir `ownerJid`.
- Em vez disso, a busca vai usar uma estratégia em camadas:
  - tentar `fetchInstances`
  - se vier vazio, tentar um endpoint mais confiável por instância
  - se ainda vier vazio, não zerar a lista inteira imediatamente

2. Validar grupo por consulta individual em tempo real
- Hoje o código depende de `fetchAllGroups(...?getParticipants=true)`, que pode vir com histórico/cached data.
- Vou usar `fetchAllGroups` só como lista inicial de JIDs `@g.us`.
- Depois, para cada grupo candidato, vou chamar `findGroupInfos/{instance}?groupJid=...`, que retorna participantes do grupo específico.
- Assim a validação passa a ser feita com metadado do grupo atual, não apenas com a listagem agregada.

3. Trocar a regra de filtragem para um fallback robusto
- Nova lógica:
  - manter só `@g.us`
  - buscar detalhes reais do grupo
  - se `participants` vier vazio, descartar
  - se houver `ownerJid`, exigir que ele esteja nos participantes
  - se `ownerJid` não puder ser resolvido, usar sinais do grupo detalhado para evitar mostrar histórico ruim:
    - participants válido
    - subject/nome consistente
    - tamanho coerente
- Isso evita o cenário atual de “mostra grupo fantasma” e também evita “zera tudo” quando a Evolution não fornece `owner`.

4. Melhorar os logs para diagnóstico direto na VPS
- Vou deixar logs separados por etapa:
  - quantos grupos vieram no `fetchAllGroups`
  - quantos foram consultados no `findGroupInfos`
  - quantos foram descartados por:
    - sem participants
    - owner ausente no grupo
    - erro ao consultar detalhes
  - quando o sistema entrou em modo fallback sem `ownerJid`
- Isso vai permitir validar tudo somente pela VPS, do jeito que você pediu.

5. Ajustar a mensagem do modal para diferenciar erro de busca vs lista vazia
- Arquivo: `src/components/grupos/GroupCampaignDialog.tsx`
- Hoje a UI mostra só “Nenhum grupo ativo encontrado”.
- Vou separar melhor:
  - “nenhum grupo válido encontrado”
  - “não foi possível validar os grupos da instância”
- Assim fica claro se o problema é ausência de grupos ou falha na validação.

6. Como validar depois na VPS
Depois da alteração, você vai rodar:

```bash
cd ~/simplificandoconversas/deploy
docker compose up -d --build backend
docker compose logs -f backend 2>&1 | grep "\[groups-api\]"
```

E ao abrir o modal, o esperado é aparecer algo assim:

```text
[groups-api] Total raw: X, @g.us: Y
[groups-api] ownerJid resolved: ...
[groups-api] validating group via findGroupInfos: ...
[groups-api] Active groups: X, Discarded: Y
```

Resultado esperado
- não listar grupos históricos/fantasma
- não depender exclusivamente de `instance.owner`
- listar só grupos realmente válidos agora
- deixar a base pronta para, na próxima etapa, validar também se a instância consegue enviar mensagem nesses grupos

Detalhes técnicos
- Arquivo principal: `deploy/backend/src/routes/groups-api.ts`
- Arquivo secundário: `src/components/grupos/GroupCampaignDialog.tsx`
- Causa raiz identificada:
  - `fetchInstances` nessa VPS não retorna `owner`
  - a lógica atual faz `return []` quando `ownerJid` vem vazio
- Ajuste estrutural:
```ts
1. fetchAllGroups -> obter JIDs candidatos
2. findGroupInfos por grupo -> obter participants reais
3. se ownerJid existir, validar participação do owner
4. se ownerJid não existir, aplicar fallback conservador por metadata real do grupo
```
