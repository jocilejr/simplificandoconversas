
Plano para corrigir o 404 da conexão externa e alinhar tudo ao seu ambiente na VPS

1. Diagnóstico do problema
- O teste atual faz `GET` exatamente na URL informada na aba “App Externa”.
- Pela sua screenshot, você está informando algo como `.../functions/v1/platform-api`.
- No backend atual, a API de integração não responde na raiz desse caminho. Ela só responde em subrotas como:
  - `/contacts`
  - `/transactions`
  - `/reminders`
- Resultado: `GET /platform-api` ou `GET /api/platform` retorna 404, mesmo com a API funcionando.

2. O que vou ajustar no código
- Backend:
  - criar um endpoint de teste dedicado para a integração, por exemplo:
    - `GET /api/platform/ping`
  - esse endpoint vai retornar algo simples como:
    ```json
    { "ok": true, "service": "platform-api" }
    ```
- Frontend da aba “App Externa”:
  - parar de testar a URL “crua”
  - normalizar a URL informada e testar sempre um endpoint válido
  - exemplo:
    - se o usuário informar `https://seu-dominio.com/api/platform`
      - testar `https://seu-dominio.com/api/platform/ping`
    - se informar `https://seu-dominio.com/functions/v1/platform-api`
      - testar `https://seu-dominio.com/functions/v1/platform-api/ping`
  - melhorar a mensagem de erro para mostrar:
    - URL testada
    - status HTTP
    - dica de correção
- UX da tela:
  - renomear o campo para deixar claro que ele espera a URL base da API externa
  - incluir exemplos válidos para VPS/self-hosted
  - bloquear ou alertar quando a URL parecer ser de ambiente errado

3. Ajuste importante para seu caso de VPS
Como você usa só a VPS, eu também vou alinhar a interface para não induzir uso de URLs do ambiente hospedado.
- Revisar a aba de documentação/API para mostrar URLs do tipo:
  - `https://SEU-DOMINIO/api/platform`
  - `https://SEU-DOMINIO/api/external-messaging-webhook`
- Evitar exibir caminhos do tipo `supabase.co/functions/v1/...` como referência principal no fluxo self-hosted.

4. Arquivos que entram no ajuste
- `src/components/settings/ExternalConnectionSection.tsx`
  - corrigir a lógica do botão “Testar Conexão”
  - melhorar placeholders, validação e mensagens
- `deploy/backend/src/routes/platform-api.ts`
  - adicionar endpoint `GET /ping` na API de integração
- `src/components/settings/IntegrationApiSection.tsx`
  - revisar exemplos/documentação para VPS
- se necessário:
  - `deploy/nginx/default.conf.template`
  - apenas se eu identificar necessidade de ajustar roteamento, mas hoje o principal problema parece ser ausência de rota raiz/ping

5. Como você pode verificar na VPS agora
Rode estes testes dentro da VPS para confirmar onde está o 404:

```bash
curl -i https://SEU-DOMINIO/api/health
```

```bash
curl -i https://SEU-DOMINIO/api/platform/reminders -H "X-API-Key: SUA_CHAVE"
```

```bash
curl -i https://SEU-DOMINIO/functions/v1/platform-api/reminders -H "X-API-Key: SUA_CHAVE"
```

E para provar o problema atual da raiz:

```bash
curl -i https://SEU-DOMINIO/api/platform -H "X-API-Key: SUA_CHAVE"
```

```bash
curl -i https://SEU-DOMINIO/functions/v1/platform-api -H "X-API-Key: SUA_CHAVE"
```

Se os endpoints com `/reminders` responderem e a raiz responder 404, o diagnóstico está confirmado.

6. Resultado esperado depois da correção
- O botão “Testar Conexão” vai funcionar de forma confiável
- A tela vai orientar corretamente quem usa VPS
- Você vai conseguir conectar sua aplicação à API externa sem falso negativo de 404
- A documentação visual deixará claro o que é:
  - conexão de entrada (externa → você)
  - conexão de saída (você → externa)

7. Observação de design da integração
Hoje a UI mistura um pouco “URL base”, “endpoint” e “webhook”.
Vou organizar isso melhor para ficar assim:
- API da app externa:
  - URL base
  - API Key
- Webhook da app externa:
  - URL de callback que sua app chama
- Sua API pública:
  - endpoints que a outra app deve consumir
- Seu webhook público:
  - endpoint que a outra app deve chamar

Assim a conexão deixa de parecer “só webhook” e passa a ficar realmente bidirecional e clara.
