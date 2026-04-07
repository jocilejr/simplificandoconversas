
## Diagnóstico

A lógica atual deste projeto ainda não segue o padrão do Finance Hub para envio imediato.

Hoje o fluxo está assim:

```text
transação criada
→ enqueueRecovery grava em recovery_queue
→ cron de 10s chama processRecoveryQueue()
→ auto-recovery envia direto para Evolution
```

Isso cria 3 pontos de falha para algo que deveria nascer da própria transação:

1. depende do cron do backend estar rodando;
2. depende do processador de fila separado;
3. a automação de transações não usa a fila global real (`message-queue.ts`), mesmo ela já existindo.

No Finance Hub, o padrão é outro:
- ao receber o evento da transação, o sistema dispara imediatamente o motor de recuperação para aquele `transactionId`;
- não fica esperando um agendador para decidir se vai começar.

## O que vou alinhar com base no Finance Hub

### Objetivo
Fazer a recuperação automática nascer do evento da transação, não do cron.

Nova lógica desejada:

```text
transação boleto/pix pendente salva
→ verifica recovery_settings do tipo
→ resolve instância
→ cria/atualiza registro de auditoria em recovery_queue
→ envia imediatamente para a fila global de mensagens da instância
→ fila global controla intervalo anti-ban
→ recovery_queue só registra status (pending/sent/failed/cancelled)
```

## Plano de implementação

### 1. Centralizar o disparo imediato por transação
Criar uma função única para processar **uma transação específica** logo após ela ser salva.

Essa função vai:
- carregar a transação pelo `transactionId`;
- validar se ainda está pendente;
- identificar o tipo (`boleto`, `pix`, `yampi`);
- ler `recovery_settings`;
- validar se o tipo está habilitado;
- resolver a instância correta (`instance_boleto`, `instance_pix`, `instance_yampi`);
- montar a mensagem usando os templates já existentes;
- registrar na `recovery_queue`;
- entregar o envio para a fila global de mensagens.

### 2. Parar de depender do cron para o primeiro disparo
Hoje `processRecoveryQueue()` é quem realmente tenta enviar.

Vou mudar a responsabilidade:
- o **primeiro envio** acontece imediatamente no evento da transação;
- o cron passa a ser apenas fallback/manual retry, se ainda fizer sentido manter.

Ou seja: a automação passa a funcionar mesmo sem “esperar a próxima rodada”.

### 3. Fazer transações usarem a fila global de mensagens de verdade
Hoje a automação de transações consulta `message_queue_config`, mas envia por `fetch()` direto, sem usar `getMessageQueue()`.

Vou alinhar isso para usar o mesmo mecanismo já usado em fluxos:
- `deploy/backend/src/lib/message-queue.ts`

Assim a regra de intervalo entre mensagens fica centralizada de verdade.

### 4. Aplicar o disparo em todos os pontos que salvam transação pendente
Não basta corrigir só um arquivo.

Vou revisar e ligar a função unificada nos pontos onde a transação nasce ou vira pendente, principalmente:
- `deploy/backend/src/routes/payment.ts`
- `deploy/backend/src/routes/yampi-webhook.ts`
- `deploy/backend/src/routes/manual-payment-webhook.ts`
- `deploy/backend/src/routes/platform-api.ts`
- outros pontos que criem boleto/pix pendente no backend VPS

Assim a regra passa a ser:
“salvou transação elegível” = “disparou automação”.

### 5. Manter `recovery_queue` como trilha de auditoria
A tabela continua útil, mas deixa de ser o gatilho principal.

Ela ficará para:
- mostrar no modal da fila;
- registrar `pending`, `sent`, `failed`, `cancelled`;
- evitar duplicidade por transação;
- permitir retry manual se necessário.

## Arquivos afetados

- `deploy/backend/src/lib/message-queue.ts`
- `deploy/backend/src/lib/recovery-enqueue.ts`
- possivelmente um novo helper de dispatch imediato, ex.:
  - `deploy/backend/src/lib/recovery-dispatch.ts`
- `deploy/backend/src/routes/payment.ts`
- `deploy/backend/src/routes/auto-recovery.ts`
- rotas adicionais que inserem transações pendentes:
  - `yampi-webhook.ts`
  - `manual-payment-webhook.ts`
  - `platform-api.ts`
  - qualquer outro writer de `transactions`

## Detalhe técnico importante

Hoje existe um desencontro conceitual:

- `message-queue.ts` = fila global real por instância;
- `auto-recovery.ts` = pseudo-fila paralela controlada por cron.

Vou eliminar essa duplicidade de responsabilidade.

A automação de transações deve:
- usar a configuração do tipo em `recovery_settings`;
- usar a cadência da instância em `message_queue_config`;
- usar a fila global real para serialização;
- registrar resultado em `recovery_queue`.

## Como validar dentro da VPS

Antes/depois da correção, peça para rodar estes comandos na VPS.

### 1. Ver últimas transações
```bash
cd ~/simplificandoconversas/deploy
docker compose exec db psql -U postgres -d postgres -c "
select id, type, status, customer_phone, created_at
from transactions
order by created_at desc
limit 10;
"
```

### 2. Ver fila de recuperação
```bash
cd ~/simplificandoconversas/deploy
docker compose exec db psql -U postgres -d postgres -c "
select id, transaction_id, transaction_type, status, scheduled_at, sent_at, error_message
from recovery_queue
order by created_at desc
limit 20;
"
```

### 3. Ver configuração da automação
```bash
cd ~/simplificandoconversas/deploy
docker compose exec db psql -U postgres -d postgres -c "
select workspace_id, enabled_boleto, instance_boleto, enabled_pix, instance_pix, enabled_yampi, instance_yampi
from recovery_settings;
"
```

### 4. Ver configuração da fila global
```bash
cd ~/simplificandoconversas/deploy
docker compose exec db psql -U postgres -d postgres -c "
select workspace_id, instance_name, delay_seconds, pause_after_sends, pause_minutes
from message_queue_config
order by created_at desc;
"
```

### 5. Acompanhar logs do backend na VPS
```bash
cd ~/simplificandoconversas/deploy
docker logs deploy-backend-1 --tail 200 -f | egrep "payment|auto-recovery|queue|yampi|manual-payment"
```

## Critério de sucesso

Após a implementação, o comportamento esperado será:

```text
boleto criado
→ log de transação salva
→ log de recovery disparado para aquele transactionId
→ item registrado na recovery_queue
→ item entregue à fila global da instância
→ envio realizado sem esperar cron
```

Se quiser, no próximo passo eu atualizo o plano já focado na implementação exata arquivo por arquivo para espelhar o padrão do Finance Hub neste backend VPS.
