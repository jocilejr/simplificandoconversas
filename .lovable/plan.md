
Objetivo: corrigir o motivo de a aba SMTP exibir erro mesmo com os campos preenchidos e alinhar o frontend ao ambiente real da sua VPS.

1. Diagnóstico encontrado no código
- O frontend hoje chama `fetch('/api/email/test')`, `fetch('/api/email/verify-smtp')` e `fetch('/api/email/stats')`.
- No seu deploy self-hosted, o Nginx separa:
  - `APP_DOMAIN` = frontend
  - `API_DOMAIN` = API
- No bloco do frontend (`location /`), não existe proxy para `/api/email/*`; então uma chamada relativa no domínio do app tende a cair no `index.html`.
- Isso explica o erro da tela: `Unexpected token '<'` = o frontend esperava JSON, mas recebeu HTML.
- Além disso, a tela de SMTP usa `forms[idx].id` ao verificar/testar. Se o servidor SMTP ainda não foi salvo, o backend tenta buscar por um registro inexistente e pode responder “SMTP não configurado”, mesmo com os campos preenchidos na interface.

2. Correção que eu faria no app
- Criar uma URL base de backend explícita para o modo VPS.
- Atualizar chamadas de e-mail para usar essa URL correta em vez de caminhos relativos.
- Corrigir o fluxo do formulário SMTP para lidar com configurações ainda não salvas.
- Melhorar o tratamento de erro para não quebrar quando a resposta vier em HTML.

3. Arquivos a ajustar
- `src/hooks/useSmtpConfig.ts`
  - trocar `/api/email/test` e `/api/email/verify-smtp` por URL absoluta baseada no ambiente da VPS
  - antes de fazer `resp.json()`, validar `content-type`; se vier HTML, mostrar erro claro
  - impedir verificação/teste sem salvar antes, ou então enviar os dados do formulário atual ao backend
- `src/hooks/useEmailSends.ts`
  - trocar `/api/email/stats` para a mesma base de API da VPS
- `src/hooks/useEmailCampaigns.ts`
  - alinhar também para a mesma estratégia de URL, porque ainda usa `VITE_SUPABASE_URL/functions/v1/email/campaign`
- `src/components/email/EmailTemplatesTab.tsx`
  - alinhar preview de e-mail para o mesmo backend/API correto
- opcionalmente criar um util central, por exemplo:
  - `src/lib/api.ts` ou helper similar para montar URLs de API de forma consistente

4. Decisão de produto/UX para SMTP
Vou seguir um destes dois caminhos na implementação:
- Opção A: exigir salvar antes de verificar/testar
  - mais simples e consistente com o backend atual
  - mensagem: “Salve a configuração antes de verificar a conexão”
- Opção B: verificar/testar usando os campos preenchidos na tela, mesmo sem salvar
  - experiência melhor
  - exige ajustar backend para aceitar credenciais no body sem depender só de `smtpConfigId`

Recomendação: Opção B, porque evita exatamente o problema que você relatou.

5. Ajustes no backend da VPS
Se quisermos a melhor experiência, também vale ajustar:
- `deploy/backend/src/routes/email.ts`
  - `POST /test` e `POST /verify-smtp` aceitarem:
    - `smtpConfigId` quando já existir
    - ou `host`, `port`, `username`, `password`, `from_email`, `from_name` enviados diretamente do formulário
- assim a validação funciona mesmo antes do save

6. O que preciso que você verifique na VPS
Como você pediu, a investigação deve ser feita dentro da VPS. Peça para rodar estes comandos e me enviar a saída:

```bash
curl -i https://SEU_APP_DOMAIN/api/email/verify-smtp
```

```bash
curl -i https://SEU_API_DOMAIN/api/email/verify-smtp
```

```bash
docker compose -f /caminho/do/projeto/deploy/docker-compose.yml logs backend --tail=100
```

```bash
grep -n "location /api/" -n /caminho/do/projeto/deploy/nginx/default.conf.template
```

```bash
grep -n "APP_DOMAIN\|API_DOMAIN\|API_URL" /caminho/do/projeto/deploy/.env
```

7. O que espero encontrar nesses testes
- No `APP_DOMAIN/api/email/verify-smtp`: provavelmente HTML do frontend
- No `API_DOMAIN/api/email/verify-smtp`: resposta do backend Express
- Nos logs do backend: possivelmente nenhuma entrada quando você clica em “Verificar Conexão”, confirmando que a requisição nem chegou ao backend

8. Resultado esperado após a correção
- A aba SMTP para de mandar “configure” quando os campos já estão preenchidos
- “Verificar conexão” e “Enviar teste” passam a funcionar na VPS
- Os erros deixam de aparecer como JSON inválido
- Stats, preview e disparos de campanha ficam consistentes no ambiente self-hosted

9. Ordem de implementação
- Primeiro: centralizar URL da API da VPS no frontend
- Segundo: corrigir `useSmtpConfig` e parsing de erro
- Terceiro: ajustar backend para aceitar teste/verificação sem save prévio
- Quarto: alinhar campanhas, stats e preview para a mesma base de API
- Quinto: revisar textos da UI para não orientar o usuário de forma errada

Detalhe técnico
```text
Hoje:
Frontend (APP_DOMAIN) -> fetch('/api/email/...') -> cai no Nginx do app -> retorna index.html

Depois:
Frontend (APP_DOMAIN) -> fetch('https://API_DOMAIN/api/email/...')
                        ou helper centralizado
                      -> Nginx da API
                      -> backend Express
                      -> JSON correto
```
