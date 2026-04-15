
Objetivo

- Fazer o Follow Up processar todos os pendentes do workspace atual sem parar no meio.
- Manter a deduplicação existente por regra/telefone/dia.
- Permitir reexecução segura dos que falharam.

Diagnóstico confirmado

- Hoje o backend do Follow Up só enfileira em memória e retorna antes do envio terminar.
- Se houver falha no meio ou reinício do backend, o restante pode ficar sem processamento.
- `failed_api` entra no mesmo bloqueio de “já contactado hoje”, então uma nova execução no mesmo dia não recupera essas falhas.
- No frontend não existe um disparo real de “executar agora”; o botão atual não força o backend a processar todos os pendentes.

O que vou implementar

1. Persistir a fila do Follow Up no banco da VPS
- Criar uma tabela de jobs do Follow Up com status como `pending`, `processing`, `sent`, `failed`, `skipped_phone_limit`, `skipped_invalid_phone`.
- Adicionar unicidade por `workspace + transaction + rule + data`, para continuar impedindo duplicados.

2. Separar “gerar candidatos” de “enviar”
- Refatorar `deploy/backend/src/routes/followup-daily.ts` para:
  - primeiro gerar todos os jobs elegíveis do dia;
  - depois consumir todos os `pending` do workspace;
  - permitir retry dos `failed` sem reenviar os `sent`.

3. Forçar processamento completo dos pendentes
- Adicionar modo manual no endpoint do backend para processar o workspace atual até zerar os jobs pendentes/falhos elegíveis.
- Manter a fila anti-ban por instância, mas agora alimentada por jobs persistidos.

4. Preservar as regras de duplicidade
- `sent` continua bloqueando novo envio.
- `skipped_phone_limit` e `skipped_invalid_phone` continuam respeitados.
- `failed_api` deixa de bloquear definitivamente e passa a poder ser reprocessado.
- O limite por telefone normalizado completo no dia continua ativo.

5. Ajustar o frontend do Follow Up
- Adicionar botão real “Executar agora”.
- Mostrar progresso real: pendentes, processando, enviados e falhas.
- Ajustar a leitura da aba para não mascarar falhas como se fossem concluídas.

Arquivos previstos

- `deploy/backend/src/routes/followup-daily.ts`
- `deploy/backend/src/index.ts`
- `deploy/backend/src/lib/message-queue.ts`
- `src/components/followup/FollowUpDashboard.tsx`
- `src/hooks/useBoletoRecovery.ts`
- `src/hooks/useFollowUpSettings.ts`

Parte técnica

```text
Fluxo novo
1) cron/manual cria jobs elegíveis no banco
2) worker backend consome pending/failed do workspace
3) sucesso => sent
4) falha temporária => failed
5) duplicado/regra válida => skipped_*
```

Validação na VPS depois da implementação

```bash
docker compose logs backend --tail=200 | grep followup-daily
docker compose exec -T postgres psql -U postgres -d postgres -c "SELECT status, count(*) FROM public.followup_dispatch_queue GROUP BY status ORDER BY status;"
docker compose exec -T postgres psql -U postgres -d postgres -c "SELECT transaction_id, rule_id, status, last_error FROM public.followup_dispatch_queue ORDER BY created_at DESC LIMIT 30;"
```

Resultado esperado

- o Follow Up não vai mais travar no meio sem controle;
- o botão manual vai forçar o envio de todos os pendentes do workspace atual;
- as regras de duplicado continuarão existentes.
