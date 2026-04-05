

# Correção: Tabelas de e-mail faltando no update.sh

## Problema
O `update.sh` tenta criar `email_follow_ups` (que referencia `email_campaigns`), `email_events` (que referencia `email_sends`), e faz `ALTER TABLE` em `smtp_config`, `email_campaigns`, `email_sends` — mas **nenhuma dessas tabelas base é criada no update.sh**. Elas só existem no `init-db.sql`, que só roda na instalação inicial.

## Solução
Adicionar os CREATE TABLE das 4 tabelas base **antes** das tabelas que as referenciam no `update.sh`:

1. `email_templates` (sem dependências)
2. `smtp_config` (sem dependências) 
3. `email_campaigns` (referencia `email_templates` e `smtp_config`)
4. `email_sends` (referencia `email_campaigns` e `email_templates`)

Depois disso, as tabelas existentes no script (`email_follow_ups`, `email_follow_up_sends`, `email_events`, `email_suppressions`) e os ALTER TABLEs vão funcionar.

Também adicionar a coluna `email` na tabela `conversations` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

## Arquivo modificado
- `deploy/update.sh` — inserir os 4 blocos CREATE TABLE + RLS + GRANT entre a seção `api_request_logs` (linha 167) e `email_follow_ups` (linha 169)

## Ordem final das migrations no update.sh
```text
... (tabelas existentes) ...
api_request_logs
email_templates        ← NOVO
smtp_config            ← NOVO  
email_campaigns        ← NOVO
email_sends            ← NOVO
conversations.email    ← NOVO (ALTER TABLE ADD COLUMN)
email_follow_ups       (já existe)
email_follow_up_sends  (já existe)
email_events           (já existe)
email_suppressions     (já existe)
ALTER smtp_config      (já existe)
ALTER email_campaigns  (já existe)
ALTER email_sends      (já existe)
```

