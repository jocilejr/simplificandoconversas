
# Plano: corrigir status falso "Inativa" no dashboard de Publicações

## Diagnóstico
O status do card não está vindo do banco diretamente. Ele pode ser sobrescrito por um `runtimeDiagnostic` em memória do scheduler.

No código atual:
- `group-scheduler.ts` grava `status_label: "Inativa"` quando a publicação é desativada
- `groups-api.ts` no endpoint `/scheduler-debug` dá prioridade a esse diagnóstico em memória
- se a publicação for reativada depois, o dashboard pode continuar mostrando o diagnóstico antigo, mesmo com a publicação existente e ativa

O detalhe importante é este:
- o label exato **"Inativa"** só nasce no scheduler em memória
- o fallback derivado do banco usaria **"Ignorada"**, não "Inativa"

Então o problema mais provável é: **diagnóstico antigo/stale tendo prioridade sobre o estado atual da publicação**.

## O que vou ajustar

### 1) Blindar o `/scheduler-debug` contra diagnóstico antigo
Arquivo:
- `deploy/backend/src/routes/groups-api.ts`

Vou ajustar a montagem do status para **ignorar runtime diagnostics inconsistentes com o estado atual**, por exemplo:
- publicação está `is_active = true`, mas o diagnóstico antigo diz `message_inactive`
- existe `hasTimer = true` e próximo horário futuro, mas o diagnóstico antigo ainda diz "Inativa"
- a publicação foi alterada depois do diagnóstico (comparando com `updated_at`)

## 2) Incluir `updated_at` na leitura das publicações
Ainda em:
- `deploy/backend/src/routes/groups-api.ts`

Vou buscar `updated_at` de `group_scheduled_messages` e usar isso para invalidar diagnóstico velho quando a publicação tiver sido reativada/editada depois.

## 3) Criar uma normalização do status antes de renderizar no debug
Em vez de passar o `runtimeDiagnostic` bruto, vou aplicar uma regra tipo:

```text
Se o diagnóstico disser "Inativa" mas:
- a publicação está ativa, ou
- há timer ativo, ou
- o próximo disparo é futuro,
então esse diagnóstico será descartado.
```

Assim o painel volta a mostrar o estado real:
- `Timer ativo` se estiver programada corretamente
- `Perdida` se realmente perdeu a janela
- `Ignorada` só quando fizer sentido
- nunca "Inativa" por memória velha

## 4) Se necessário, reforçar o resync ao reativar
Arquivo:
- `deploy/backend/src/lib/group-scheduler.ts`

Se eu encontrar na revisão final que o scheduler não está limpando/substituindo o diagnóstico em algum fluxo de reativação, vou reforçar isso no próprio `scheduleMessage`, para garantir que uma publicação reativada sempre saia de "Inativa" e entre em "Aguardando/Timer ativo".

## Arquivos previstos
- `deploy/backend/src/routes/groups-api.ts`
- possivelmente `deploy/backend/src/lib/group-scheduler.ts`

## Como vou validar depois
Depois da correção, a validação na sua VPS vai ser:

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT id, is_active, next_run_at, last_run_at, updated_at, content->>'runTime' AS run_time
FROM group_scheduled_messages
WHERE campaign_id = 'b63ff159-21b2-4c79-b1b7-8709ab1b0272'
ORDER BY updated_at DESC
LIMIT 20;
"
```

E também:
```bash
docker logs deploy-backend-1 --since=30m 2>&1 | grep -i "\[scheduler\]\|scheduler-debug\|Timer set" | tail -80
```

## Resultado esperado
O card deixa de mostrar **"Inativa"** indevidamente para publicações que existem e estão ativas, e passa a refletir o estado real do scheduler.
