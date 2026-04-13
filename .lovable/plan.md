

## Problema

O `update.sh` tem dois gargalos sérios:

1. **Backup de mídia (passo 2)** — faz `tar czf` de **toda** a pasta `/media-files` dentro do container a cada deploy. Se você tem GBs de mídia de webhook, isso demora dezenas de minutos e é desnecessário (já implementamos o cleanup de temporários).

2. **500+ linhas de SQL idempotente (passo 3)** — roda `CREATE TABLE IF NOT EXISTS` para ~20 tabelas + políticas + índices toda vez. São operações baratas individualmente, mas o overhead de 3 `psql` separados + validação tabela-por-tabela soma tempo.

## Solução

### 1. Remover o backup de mídia do deploy

O passo `[2/6]` (linhas 18-28) será **removido completamente**. Justificativa:
- Arquivos permanentes (fluxos, produtos) já estão no volume Docker persistente
- Arquivos temporários (+24h) agora podem ser limpos pelo botão na interface
- Backup de mídia deve ser feito por cron separado, não a cada deploy
- O `sanitize-storage.sh` já protege arquivos referenciados no banco

### 2. Otimizar as migrações SQL

- Consolidar os 3 blocos `psql` separados (schema base, migrate-workspace, fix-member-tables) em **uma única execução** com `cat ... | psql`
- Remover a validação tabela-por-tabela (loop de 17 tabelas com `psql` individual) — as migrations já são idempotentes com `IF NOT EXISTS`
- Manter apenas a verificação de orphan users (1 query) e o restart do PostgREST

### 3. Resultado esperado

O script passará de **6 passos** para **5 passos** com tempo estimado:
- Antes: git pull + backup (10-30min) + SQL (1-2min) + build + containers + restart
- Depois: git pull + SQL consolidado (30s) + build + containers + restart

### Arquivos alterados

- `deploy/update.sh` — reescrita dos passos 2-3, renumeração para 5 passos

