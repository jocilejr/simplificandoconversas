
Objetivo: impedir que o modal mostre grupos “fantasma” do histórico e exibir apenas grupos realmente utilizáveis agora pela instância na VPS.

1. Ajustar a regra do backend em `deploy/backend/src/routes/groups-api.ts`
- O filtro atual ainda deixa passar grupos quando `participants` vem vazio ou quando `ownerJid` não é resolvido.
- Isso é exatamente a brecha que permite grupos antigos/inexistentes aparecerem.
- Vou tornar o filtro restritivo:
  - manter apenas JIDs `@g.us`
  - exigir `ownerJid` válido
  - exigir lista de participantes válida
  - manter só grupos onde `ownerJid` está nos participantes
- Resultado: se a API não conseguir provar que a instância está no grupo, o grupo não entra na lista.

2. Normalizar a leitura do retorno da Evolution
- Hoje o código assume formatos simples (`p.id` / `p.jid`).
- Vou ampliar a normalização para suportar formatos comuns da Evolution, como:
  - `participant.id`
  - `participant.jid`
  - strings simples
  - variações com sufixos diferentes
- Também vou normalizar `ownerJid` para comparação consistente.

3. Filtrar por grupos com possibilidade real de envio
- Além da presença da instância nos participantes, vou usar sinais do próprio payload para remover grupos claramente inviáveis:
  - JID ausente/inválido
  - nome vazio suspeito
  - grupo sem metadados mínimos
- O objetivo não é só “existir no histórico”, mas parecer um grupo operacional.

4. Melhorar logs para você validar dentro da VPS
- Como você usa apenas a VPS, a investigação precisa ser feita aí.
- Vou deixar logs mais objetivos no backend mostrando:
  - `ownerJid` resolvido
  - quantidade total recebida
  - quantidade após filtro `@g.us`
  - quantidade após filtro de participação ativa
  - alguns JIDs descartados por falta de participantes / owner
- Isso facilita confirmar se o problema é dado antigo da Evolution ou falha de parsing.

5. Ajustar a UX do modal de campanha
- Em `src/components/grupos/GroupCampaignDialog.tsx`, vou preparar a interface para lidar melhor com lista restrita:
  - mensagem mais clara quando nenhum grupo ativo for encontrado
  - orientação para reconectar/sincronizar a instância se necessário
- Assim o usuário entende por que a lista pode vir vazia após endurecer o filtro.

6. Validação que vou te pedir para fazer na VPS
- Rebuild do backend:
```bash
docker compose up -d --build backend
```
- Depois testar o fetch da instância e conferir os logs:
```bash
docker compose logs -f backend
```
- Se ainda aparecer grupo inexistente, vou te pedir o trecho de log com:
  - `ownerJid resolved`
  - total de grupos retornados
  - grupos descartados
- Se necessário, a próxima etapa será validar diretamente a resposta bruta da Evolution nessa VPS para ver se ela está devolvendo grupos históricos sem participantes atualizados.

Detalhes técnicos
- Arquivo principal: `deploy/backend/src/routes/groups-api.ts`
- Ajuste secundário: `src/components/grupos/GroupCampaignDialog.tsx`
- Causa provável encontrada:
  - linha atual permite `return true` quando `participants.length === 0 || !ownerJid`
  - isso faz grupos não confirmados entrarem na lista
- Nova regra esperada:
```ts
if (!jid.endsWith("@g.us")) return false;
if (!ownerJid) return false;
if (!Array.isArray(participants) || participants.length === 0) return false;
return participantsNormalizados.includes(ownerJidNormalizado);
```

<lov-actions>
<lov-suggestion message="Teste isso end-to-end na VPS: abra o modal da campanha, selecione a instância e verifique se só aparecem grupos ativos de verdade">Verificar na VPS</lov-suggestion>
<lov-suggestion message="Depois disso, adicione um botão de re-sincronizar grupos da instância para atualizar a lista manualmente no modal">Adicionar re-sincronização</lov-suggestion>
<lov-suggestion message="Crie uma validação visual no modal para destacar grupos sem permissão de envio ou com metadados incompletos">Destacar grupos inválidos</lov-suggestion>
</lov-actions>
