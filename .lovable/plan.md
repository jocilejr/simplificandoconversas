
Objetivo: corrigir definitivamente o webhook da OpenPix para sempre gerar URL funcional sem preenchimento manual.

Diagnóstico (com base no código atual)
- O backend já responde GET 200 em `deploy/backend/src/routes/webhook-transactions.ts`.
- O 404 no seu teste (`/api/webhook-transactions/...`) indica problema de roteamento externo (Nginx/API), não da rota Express.
- Hoje a UI gera URL com `app_public_url + /api/webhook-transactions/...`; isso é frágil para VPS com domínios separados app/api.

Plano de correção

1) Validar rota que já funciona na VPS (sem mudar código)
- Rodar:
  - `curl -i "https://api.chatbotsimplificado.com/functions/v1/webhook-transactions/openpix?user_id=test"`
  - `curl -i "https://api.chatbotsimplificado.com/api/webhook-transactions/openpix?user_id=test"`
- Esperado:
  - `/functions/v1/...` deve responder 200
  - `/api/...` hoje está 404 (confirmando o gargalo no Nginx)

2) Ajustar geração automática da URL no frontend (sem input manual)
- Arquivo: `src/components/settings/IntegrationsSection.tsx`
- Alterar `buildWebhookUrl` para usar base da API via `import.meta.env.VITE_SUPABASE_URL` (na sua VPS isso aponta para `API_URL`), no formato:
  - `{VITE_SUPABASE_URL}/functions/v1/webhook-transactions/{platform}?user_id={user.id}`
- Remover dependência de `profile.app_public_url` para webhook (manter só para outros recursos, se necessário).
- Resultado: integração OpenPix cria URL correta automaticamente em qualquer usuário.

3) Compatibilidade retroativa para links antigos `/api/...` (opcional, recomendado)
- Arquivo: `deploy/nginx/default.conf.template`
- Adicionar `location /api/webhook-transactions/` com `proxy_pass http://backend:3001/api/webhook-transactions/;`
- Isso evita quebrar webhooks já cadastrados com URL antiga.

4) Deploy na VPS
- Rebuild backend/frontend conforme seu fluxo:
  - `cd /root/simplificandoconversas/deploy`
  - `./update.sh` (ou `docker compose up -d --build`)
- Se alterar template do Nginx, aplicar recriação:
  - `docker compose up -d --force-recreate nginx`

5) Validação fim a fim (obrigatória)
- Testar:
  - URL gerada na tela de Integrações (OpenPix) retorna 200
  - Cadastro do webhook no painel OpenPix aceita a URL
  - Envio de evento de teste da OpenPix chega no backend:
    - `docker compose logs --tail=200 backend | grep webhook-transactions`

Critério de pronto
- Nova integração OpenPix não pede credenciais
- URL é gerada automaticamente e responde 200
- OpenPix valida webhook com sucesso
- Eventos entram sem erro 404
