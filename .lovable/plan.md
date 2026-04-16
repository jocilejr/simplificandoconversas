
Objetivo: fazer a regra funcionar de forma confiável: ao receber a tag pela API externa, o sistema deve 1) salvar o contato, 2) identificar a campanha automática correta, 3) registrar a tentativa no banco, 4) enfileirar/enviar o material, e 5) deixar rastros claros para debug na VPS.

O que encontrei no código:
- O evento externo é `register_email` em `deploy/backend/src/routes/email.ts`.
- Hoje ele já salva o contato em `email_contacts` e depois tenta localizar campanhas com:
  - `auto_send = true`
  - `status = "draft"`
  - `tag_filter` preenchida
- Se a tag bater, ele só enfileira em `email_queue`.
- O envio real acontece depois, em outro fluxo: `/api/email/process-queue`.
- Se o auto-envio falhar, o código só faz `console.error(...)` e ainda retorna `ok: true`. Ou seja: pode parecer sucesso mesmo sem ter enfileirado ou enviado.
- Além disso, o histórico visível de envio (`email_sends`) só nasce no processamento da fila. Então hoje existe um “buraco”: o webhook pode receber a tag, mas você não vê imediatamente um registro claro de tentativa/envio.

Plano de correção:
1. Ajustar `deploy/backend/src/routes/email.ts` no bloco `register_email`
- Normalizar as tags recebidas antes da comparação:
  - trim
  - lowercase
  - remover duplicadas
- Comparar a tag da campanha com a tag recebida de forma previsível.
- Parar de “engolir” falhas silenciosas:
  - se houver campanha compatível e a fila falhar, retornar erro no webhook em vez de `ok: true`.
- Incluir logs detalhados no backend:
  - tag recebida
  - campanhas avaliadas
  - campanha que casou
  - item criado na fila
  - erro exato, se houver

2. Tornar o salvamento no banco explícito e imediato
- Manter o `email_contacts`.
- Registrar a tentativa da campanha automática já no momento do webhook, sem depender só do cron da fila.
- Deixar claro no banco se foi:
  - contato salvo
  - campanha encontrada
  - item enfileirado
  - envio processado ou falhou
- Se necessário, usar o fluxo atual com `email_queue` + `email_sends`, mas garantindo que a tentativa já fique rastreável imediatamente.

3. Revisar a regra de campanha automática
- Confirmar no backend que a regra válida é exatamente:
  “recebeu a tag X” -> “dispara a campanha com `auto_send=true` e `tag_filter = X`”.
- Garantir que campanhas desativadas ou fora da regra não disparem.
- Validar que follow-ups só sejam criados quando o envio principal realmente entrou no fluxo.

4. Melhorar a observabilidade da fila
- Em `deploy/backend/src/routes/email.ts` no `/process-queue`, reforçar logs para:
  - template ausente
  - SMTP ausente/inválido
  - falha de envio
  - item marcado como sent/failed
- Assim a VPS mostra exatamente onde o fluxo quebrou.

5. Ajustar a resposta do webhook externo
- Em vez de responder só:
  `ok/contactId/corrected/email`
- responder também com diagnóstico útil, por exemplo:
  - `matchedCampaigns`
  - `queued`
  - `sentLaterViaQueue`
  - `errors`
Isso evita falso positivo.

Como vou validar depois da implementação:
- Disparar novamente o `register_email` com a tag da campanha.
- Confirmar 4 pontos:
  1. entrou em `email_contacts`
  2. encontrou a campanha automática correta
  3. criou registro na fila/log
  4. gerou envio ou falha rastreável

Comandos que vou te deixar para validar na VPS depois:
```bash
docker logs deploy-backend-1 --since=20m 2>&1 | grep -Ei "email/webhook|email/auto-send|email/queue|process-queue"
```

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
select id, email, name, tags, source, status, created_at
from email_contacts
where lower(email) = 'genezio.pereira.silva@gmail.com'
order by created_at desc
limit 20;
"
```

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
select id, name, tag_filter, auto_send, status, sent_count, failed_count, created_at
from email_campaigns
where auto_send = true
order by created_at desc;
"
```

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
select id, campaign_id, recipient_email, status, error_message, created_at, processed_at
from email_queue
where lower(recipient_email) = 'genezio.pereira.silva@gmail.com'
order by created_at desc
limit 20;
"
```

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
select id, campaign_id, recipient_email, status, error_message, created_at
from email_sends
where lower(recipient_email) = 'genezio.pereira.silva@gmail.com'
order by created_at desc
limit 20;
"
```

Resultado esperado após a correção:
- Ao chegar a tag correta, a campanha automática dispara de verdade.
- O contato fica salvo.
- A tentativa/envio fica salvo e rastreável no banco.
- Se algo falhar, o webhook não responde falso positivo e a VPS mostra o motivo exato.
