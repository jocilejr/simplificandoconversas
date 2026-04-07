

# Correção: Template ignorado + Fila Global com erro

## Diagnóstico confirmado

### Problema 1: Template não respeitado
Os logs do backend mostram **zero** linhas com `recovery-dispatch`. Isso significa que o código atualizado (com suporte a templates de blocos) **ainda não foi implantado na VPS**. O backend rodando ainda é a versão antiga que usa apenas a mensagem legada do `profiles`.

O template existe e está correto no banco:
- `Principal`, `is_default=true`, 3 blocos (text + pdf + image)

**Solução**: Rebuild do backend na VPS para que o novo `recovery-dispatch.ts` entre em vigor.

### Problema 2: Fila Global (message_queue_config) dando erro ao salvar
A tabela `message_queue_config` **não existe na VPS**. Ela foi criada no Lovable Cloud via migration, mas nunca foi adicionada ao `deploy/init-db.sql`. O frontend tenta inserir/atualizar nela e recebe erro do PostgREST.

**Solução**: Adicionar o CREATE TABLE no `init-db.sql` e fornecer SQL para criar na VPS.

## Plano de implementação

### 1. Adicionar `message_queue_config` ao `init-db.sql`
Incluir a criação da tabela com as mesmas colunas e RLS policies do Lovable Cloud:
```sql
CREATE TABLE IF NOT EXISTS message_queue_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  instance_name text NOT NULL,
  delay_seconds integer NOT NULL DEFAULT 30,
  pause_after_sends integer,
  pause_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE message_queue_config ENABLE ROW LEVEL SECURITY;
```

### 2. Fornecer SQL para rodar diretamente na VPS
Para criar a tabela sem precisar refazer o init-db inteiro.

### 3. Rebuild do backend
O código do `recovery-dispatch.ts` já está correto (templates + normalização de telefone). Só precisa ser implantado.

## Comandos para o usuário executar na VPS

**Passo 1** — Criar a tabela que falta:
```bash
docker compose exec postgres psql -U postgres -d postgres -c "
CREATE TABLE IF NOT EXISTS message_queue_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  instance_name text NOT NULL,
  delay_seconds integer NOT NULL DEFAULT 30,
  pause_after_sends integer,
  pause_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE message_queue_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_all ON message_queue_config FOR ALL TO service_role USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';
"
```

**Passo 2** — Reiniciar PostgREST para reconhecer a nova tabela:
```bash
docker compose restart postgrest
```

**Passo 3** — Rebuild do backend (para implantar o recovery-dispatch com templates):
```bash
docker compose up -d --build backend
```

**Passo 4** — Limpar itens antigos de teste e testar:
```bash
docker compose exec postgres psql -U postgres -d postgres --no-align -t -c "DELETE FROM recovery_queue WHERE status = 'failed';"
```

**Passo 5** — Após criar uma nova transação de teste, verificar:
```bash
docker logs deploy-backend-1 --tail 100 2>&1 | grep "recovery-dispatch"
```

## Alteração no código

Adicionar a criação da tabela `message_queue_config` no `deploy/init-db.sql` para que futuros deploys a criem automaticamente.

