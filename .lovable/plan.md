
# Plano: corrigir “pendentes” falsos e evitar retry inútil em número inexistente

## Diagnóstico confirmado
Os logs da VPS mostram que o retry novo funcionou, mas os 3 itens reprocessados falharam por erro determinístico da Evolution:

```text
exists:false
```

Ou seja: não é falha momentânea de deploy nesses 3 casos. O número foi aceito pela normalização, mas o WhatsApp não existe.

Além disso, o frontend hoje mistura “falhou” com “pendente”:
- `src/hooks/useBoletoRecovery.ts`
  - `contactedToday` exclui `failed`, então alguns itens falhados voltam a aparecer como `pending`
  - `pendingTodayBoletos` inclui `failed`
- `src/components/followup/FollowUpDashboard.tsx`
  - `effectivePending` soma `failed`
  - o modal “Fila” recebe `pendingTodayBoletos`, então mostra falhas como se ainda fossem pendências

Resultado: você vê “9 pendentes”, mas na fila real de hoje não há `pending`; há `failed`, `sent`, `skipped_duplicate` e `skipped_invalid_phone`.

## O que vou ajustar

### 1) Corrigir status no frontend
Arquivos:
- `src/hooks/useBoletoRecovery.ts`
- `src/components/followup/FollowUpDashboard.tsx`

Ajustes:
- separar `hasRecord` de `contactedToday`
- definir `sendStatus` com base no registro real, não no `contactedToday`
- remover `failed` da lista de “pendentes”
- fazer o card “Pendentes” contar só `pending + processing`
- manter “Falhas” separado
- fazer o modal “Fila” abrir só com pendentes reais, não com falhados

## 2) Tornar erro `exists:false` não-retentável
Arquivo:
- `deploy/backend/src/routes/followup-daily.ts`

Ajustes:
- detectar no `catch` do retry quando a Evolution responde `exists:false`
- parar o loop imediatamente nesses casos
- marcar o job com status não retentável, em vez de gastar 5 tentativas

### Abordagem recomendada
Reaproveitar o status já existente `skipped_invalid_phone` para esse caso, com mensagem mais clara, por exemplo:
```text
Número sem WhatsApp na Evolution (exists:false)
```

Assim:
- falha transitória continua com retry 5x / 10s
- número inexistente não consome retry à toa
- o dashboard para de inflar “pendentes”

## 3) Ajustar contadores e UX
No dashboard:
- “Pendentes” = apenas `pending` + `processing`
- “Falhas” continua visível no resumo detalhado
- itens `failed` e `skipped_invalid_phone` aparecem com badge correto
- “Concluído” pode incluir falhas separadamente sem chamá-las de pendentes

## Resultado esperado
Depois da correção:
- os 3 casos do log deixarão de parecer pendências
- o botão/manual run só tentará novamente falhas transitórias reais
- números com `exists:false` serão classificados corretamente
- o total de “pendentes” passará a refletir apenas o que ainda está de fato aguardando processamento

## Verificação na VPS depois da implementação
Vou te deixar validar com estes comandos:

```bash
docker logs deploy-backend-1 --since 30m 2>&1 | grep -i "followup\|dispatch\|daily\|exists\|failed\|skipped" | tail -80
```

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT status, count(*)
FROM followup_dispatch_queue
WHERE dispatch_date = CURRENT_DATE
GROUP BY status
ORDER BY status;
"
```

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT transaction_id, status, attempts, last_error, normalized_phone
FROM followup_dispatch_queue
WHERE dispatch_date = CURRENT_DATE
ORDER BY created_at DESC;
"
```

## Deploy
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```
