
Objetivo

Resolver o bloqueio atual diretamente na VPS: hoje o teste local falhou porque o container não tem `curl`, e o webhook ainda pode estar quebrando por erro oculto ou por divergência entre o schema self-hosted e o código.

Plano

1. Corrigir onde a X-API-Key aparece no painel
- Arquivo: `src/components/settings/EmailSettingsSection.tsx`
- Ajustar a leitura da chave para buscar `platform = "custom_api"` em vez de `integration_api`.
- Isso faz a mesma chave de `Configurações → API` aparecer também na aba de webhooks de e-mail.

2. Melhorar o diagnóstico do webhook
- Arquivo: `deploy/backend/src/routes/email.ts`
- Fortalecer o `catch` do endpoint `/webhook/inbound` para logar o erro completo e sempre devolver uma mensagem útil, em vez de `{}`.
- Logar explicitamente falhas da autenticação e do `upsert` em `email_contacts`.
- Alinhar a autenticação com o padrão da API principal, incluindo a checagem de `enabled`.

3. Sincronizar o banco do deploy self-hosted com o recurso de e-mail
- Arquivos: `deploy/init-db.sql` e `deploy/update.sh`
- Adicionar ao deploy da VPS as tabelas usadas por esse fluxo e que não estão nesses scripts hoje:
  - `public.platform_connections`
  - `public.email_contacts`
- Em `email_contacts`, garantir índice/constraint único em `(user_id, email)`.
- Aplicar RLS e grants no mesmo padrão já usado no projeto.
- Manter reload do PostgREST após as migrações.

4. Não depender de `curl` para validar na VPS
- Não preciso instalar `curl` agora para resolver o problema.
- Vou considerar `wget` como ferramenta padrão de teste dentro do container, porque o próprio deploy já usa isso no healthcheck.
- Só vale adicionar `curl` no Dockerfile se você quiser essa conveniência permanente.

Detalhes técnicos

- O webhook usa `upsert(..., { onConflict: "user_id,email" })`, então a VPS precisa ter a tabela `email_contacts` com índice/constraint compatível.
- A UI de E-mail hoje lê a chave do lugar errado, por isso pode parecer que a `X-API-Key` “não existe”.
- Como seu uso é 100% na VPS, o deploy self-hosted precisa ser a fonte de verdade dessas tabelas e não pode ficar defasado em relação ao app.

Validação na VPS após a implementação

```bash
cd /root/simplificandoconversas/deploy

docker compose exec -T postgres psql -U postgres -d postgres -c "\dt public.email_contacts"
docker compose exec -T postgres psql -U postgres -d postgres -c "\dt public.platform_connections"

docker compose exec -T backend wget -qO- \
  --header="Content-Type: application/json" \
  --header="X-API-Key: SUA_CHAVE_API_AQUI" \
  --post-data='{"event":"register_email","data":{"email":"teste@example.com","name":"Teste","tags":["lead"]}}' \
  http://localhost:3001/api/email/webhook/inbound

docker compose logs backend --tail=100
```

Deploy esperado

```bash
cd /root/simplificandoconversas/deploy
./update.sh
```
