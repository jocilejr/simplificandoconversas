
Objetivo: deixar o fluxo exatamente assim:

```text
Nova transação
  -> automação ativa?
      -> não: encerra
      -> sim: entra UMA vez na fila da instância
                -> a própria fila executa
                -> a própria fila retorna sent/failed/cancelled
```

O que identifiquei no código atual:
- A fila universal da instância já existe e já é usada em `deploy/backend/src/lib/message-queue.ts`.
- O follow-up já usa essa fila corretamente como processador universal.
- O problema está em `deploy/backend/src/lib/recovery-dispatch.ts`: ele grava em `recovery_queue` como `pending` antes de garantir que o item realmente entrou na fila.
- Também existe um fluxo paralelo/manual em `deploy/backend/src/routes/auto-recovery.ts`, que foge do modelo simples que você definiu.
- O label atual do item na fila é genérico (`recovery:${txId}`), então no painel não fica claro que aquilo é uma transação.

Plano de implementação:

1. Simplificar o `dispatchRecovery` para ser apenas “decidir e enfileirar”
- Arquivo: `deploy/backend/src/lib/recovery-dispatch.ts`
- Manter:
  - validação de automação ativa
  - resolução da instância correta
  - carregamento do template/mensagem
  - leitura da configuração da fila da instância
- Mudar:
  - só criar/atualizar o registro de auditoria depois que o item entrar na fila com sucesso
  - a execução real, sucesso e erro ficam sob responsabilidade do callback da própria fila
  - remover qualquer semântica de retry externo/manual desse fluxo

2. Fazer a fila ser a única responsável pelo processamento
- Arquivo: `deploy/backend/src/lib/recovery-dispatch.ts`
- O item será enfileirado uma única vez via `getMessageQueue(instanceName, ...)`
- Dentro do `queue.enqueue(...)`:
  - revalida status da transação antes de enviar
  - envia os blocos
  - marca `sent`, `failed` ou `cancelled`
- Se nem conseguiu entrar na fila:
  - registrar erro imediato
  - não deixar item “pendente órfão”

3. Remover o caminho paralelo de auto recovery
- Arquivos:
  - `deploy/backend/src/routes/auto-recovery.ts`
  - `deploy/backend/src/index.ts`
- Remover a rota manual `/api/auto-recovery`
- Remover import e uso do router
- Não criar cron
- Resultado: não existe segundo processador; só a fila universal processa

4. Ajustar a auditoria para refletir a fila real
- Arquivo: `deploy/backend/src/lib/recovery-dispatch.ts`
- `recovery_queue` passa a ser trilha de status do item que realmente entrou na fila
- Estados esperados:
  - `queued` ou `pending` somente quando já estiver dentro da fila
  - `sent`
  - `failed`
  - `cancelled`
- Sem registros “fantasma” criados antes do enqueue real

5. Melhorar identificação do item na fila sem especializar a fila
- Arquivos:
  - `deploy/backend/src/lib/recovery-dispatch.ts`
  - opcionalmente `src/components/settings/ConnectionsSection.tsx`
- Não vou transformar a fila em fila “de transações”
- Vou só mudar o label do item para algo humano, por exemplo:
  - `tx:boleto:5534991167017`
  - `tx:pix:5511999999999`
- Assim continua universal, mas passa a aparecer claramente no painel e nos logs

6. Garantir que todas as entradas transacionais usem o mesmo ponto único
- Arquivos que já chamam `dispatchRecovery` e devem continuar centralizados nele:
  - `deploy/backend/src/routes/manual-payment-webhook.ts`
  - `deploy/backend/src/routes/payment.ts`
  - `deploy/backend/src/routes/platform-api.ts`
  - `deploy/backend/src/routes/yampi-webhook.ts`
- A ideia não é mexer na fila em vários lugares; é garantir que todos passem pelo mesmo dispatcher simples

Resultado esperado:
- Nova transação
- Automação ativa
- Entra uma vez na fila da instância
- A fila processa
- O retorno final sai da própria fila
- Sem cron
- Sem auto-recovery
- Sem fluxo paralelo
- Sem “pending” órfão criado antes da hora

Arquivos principais a alterar:
- `deploy/backend/src/lib/recovery-dispatch.ts`
- `deploy/backend/src/routes/auto-recovery.ts`
- `deploy/backend/src/index.ts`

Arquivos para validar integração:
- `deploy/backend/src/routes/manual-payment-webhook.ts`
- `deploy/backend/src/routes/payment.ts`
- `deploy/backend/src/routes/platform-api.ts`
- `deploy/backend/src/routes/yampi-webhook.ts`

Detalhe técnico importante:
- Não vou reconfigurar a fila para transações.
- A fila continua universal e independente.
- Só vou corrigir o ponto de entrada transacional para obedecer exatamente o contrato que você definiu: “entrou na fila uma vez, a fila resolve o resto”.
