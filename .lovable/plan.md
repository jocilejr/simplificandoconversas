

## Investigação necessária

Vou clonar/inspecionar o repo de referência para entender exatamente como ele monitora grupos, depois comparar com o nosso código atual e propor o port das partes relevantes.

## Passo 1 — Ler o repo de referência

Vou usar `code--fetch_website` para abrir os arquivos chave do GitHub:

1. `https://github.com/jocilejr/whats-grupos` — README e estrutura
2. Identificar arquivos relacionados a:
   - Webhook de eventos de grupo (handler do `group-participants.update`)
   - Sincronização periódica (cron / scheduler)
   - Cálculo de "entraram" e "saíram" (query SQL ou agregação)
   - Modelo de dados (schema das tabelas)
   - Endpoint que alimenta o dashboard

3. Abrir cada arquivo relevante e ler integralmente

## Passo 2 — Ler o nosso código atual lado-a-lado

- `deploy/backend/src/routes/groups-webhook.ts` (handler webhook)
- `deploy/backend/src/routes/groups-api.ts` (endpoint `/events`, `/sync-stats`, agregações)
- `deploy/backend/src/index.ts` (cron de 1h)
- `src/hooks/useGroupEvents.ts` (consumo no frontend)
- `src/components/grupos/GroupDashboardTab.tsx` (cards entraram/saíram)
- Migrations atuais de `group_participant_events` e `group_daily_stats`

## Passo 3 — Comparar e identificar diferenças

Vou produzir uma tabela de diff por dimensão:
- Esquema de tabelas
- Estratégia de dedup
- Fonte de verdade dos números (eventos vs sincronização full vs híbrido)
- Frequência e gatilho do sync
- Filtro por instância
- Tratamento de @lid

## Passo 4 — Apresentar plano de port

Após entender o que o repo faz de diferente, apresentarei um plano detalhado de mudanças no nosso código, **portando exatamente a abordagem dele** (não adaptando), incluindo:
- Migrações SQL necessárias
- Reescrita dos handlers
- Ajustes no frontend
- Comandos de validação na VPS

## Próximo passo

Aprovar este plano de investigação para que eu possa abrir o repo e os arquivos atuais. Após a leitura, voltarei com o plano de implementação concreto baseado no que o `whats-grupos` faz de diferente.

