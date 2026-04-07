
Objetivo

Corrigir o envio automático na VPS para seguir o comportamento do Finance Hub: a transação continua sendo criada imediatamente, mas a mensagem deve ser enviada com o telefone no formato correto para a Evolution.

Diagnóstico confirmado

Os dados da VPS já mostram que o disparo automático acontece:
- a transação foi criada
- o item entrou em `recovery_queue`
- o status foi para `failed`

A falha real está aqui:

```text
Evolution API 400
exists=false
number: 89981340810@s.whatsapp.net
```

Isso indica que o backend atual está chamando a Evolution com o número no formato errado para esse fluxo.

Comparação com o Finance Hub

No Finance Hub, o envio passa por uma camada que:
- remove caracteres não numéricos
- remove `0` inicial
- adiciona `55` quando o número ainda não tem código do país
- envia para a API usando número puro, sem `@s.whatsapp.net`

Exemplo do seu caso:

```text
Hoje:
89981340810@s.whatsapp.net

Correto para envio:
5589981340810
```

Plano de implementação

1. Ajustar `deploy/backend/src/lib/recovery-dispatch.ts`
- Centralizar a normalização do telefone dentro do próprio dispatch.
- Reproduzir o padrão do Finance Hub:
  - limpar não numéricos
  - remover zero inicial
  - prefixar `55` quando faltar DDI
- Enviar para a Evolution com número puro.
- Parar de montar `@s.whatsapp.net` no payload do `sendText`.

2. Melhorar logs do fluxo no mesmo arquivo
- Adicionar logs explícitos para:
  - início do dispatch
  - settings encontradas
  - instância escolhida
  - telefone original e telefone normalizado
  - início do envio
  - resposta de erro da Evolution
- Isso vai permitir investigar direto pela VPS com `docker logs`, sem depender de tentativa cega.

3. Endurecer validações antes do envio
- Se o telefone normalizado ficar inválido, marcar `recovery_queue` como `failed` com motivo claro.
- Evitar erro genérico da Evolution quando o próprio backend já consegue detectar número ruim.

4. Manter a arquitetura atual
- Não vou voltar para cron como fluxo principal.
- O envio continuará event-driven via `dispatchRecovery`.
- O cron de `auto-recovery` permanece apenas como fallback para itens presos.

5. Validar na VPS após rebuild
Rodar um novo teste criando outra transação pendente e conferir:

```bash
docker logs deploy-backend-1 --tail 200 2>&1 | egrep "recovery-dispatch|manual-payment|payment|queue"

docker compose exec postgres psql -U postgres -d postgres --no-align -t -c "SELECT transaction_id, customer_phone, transaction_type, status, error_message, created_at, sent_at FROM recovery_queue ORDER BY created_at DESC LIMIT 10;"

docker compose exec postgres psql -U postgres -d postgres --no-align -t -c "SELECT id, type, status, customer_phone, customer_name, amount, created_at FROM transactions ORDER BY created_at DESC LIMIT 5;"
```

Critério de sucesso

Depois da correção, o esperado é:

```text
transação criada
→ dispatchRecovery é chamado
→ telefone é normalizado para 55 + DDD + número
→ item entra em recovery_queue
→ fila global dispara
→ recovery_queue.status = sent
→ sent_at preenchido
→ sem erro exists=false
```

Detalhes técnicos

```text
Arquivo principal:
deploy/backend/src/lib/recovery-dispatch.ts

Mudança central:
number: "5589981340810"
em vez de
number: "89981340810@s.whatsapp.net"

Referência confirmada no Finance Hub:
- supabase/functions/send-external-message/index.ts
- normalização com prefixo 55
- envio com telefone puro
```
