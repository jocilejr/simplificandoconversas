

## Diagnóstico

A causa raiz do problema foi identificada com precisão nos logs:

**O que aconteceu:**
1. Execução `0142898e` criou um `waitForClick` com timeout de 2h às 13:15
2. O contato clicou no link às 13:15:43 -- a execução foi marcada como `completed`
3. Porém, o **timeout NÃO foi cancelado** pelo `link-redirect`
4. Às 15:16, o `check-timeouts` encontrou esse timeout expirado e **resumiu o fluxo**, mesmo a execução original já estando completada
5. Além disso, `check-timeouts` não passa `instanceName`, fazendo o fluxo rodar na instância errada ("Meire Rosana - Entregas" em vez de "FunilPrincipal")

**Três bugs identificados:**

### Bug 1: `check-timeouts` não verifica o status da execução
Ele processa timeouts cegamente sem verificar se a execução original ainda está ativa (`waiting_click`/`waiting_reply`). Se já foi completada ou cancelada, o timeout deveria ser ignorado.

### Bug 2: `check-timeouts` não passa `instanceName`
A chamada ao `execute-flow` na linha 72 não inclui `instanceName`, fazendo o fluxo ser executado na instância padrão do perfil em vez da correta.

### Bug 3: `link-redirect` não cancela timeouts pendentes
Quando o link é clicado, a execução é marcada como `completed`, mas os timeouts associados continuam com `processed: false`, permitindo que disparem depois.

---

## Correções

### 1. `supabase/functions/check-timeouts/index.ts`
- Antes de processar cada timeout, verificar o status atual da execução no banco
- Se a execução **não** estiver em `waiting_click` ou `waiting_reply`, marcar o timeout como processado e **pular** (não resumir)
- Buscar `instance_name` da execução e incluir na chamada ao `execute-flow`

### 2. `supabase/functions/link-redirect/index.ts`
- Após marcar o clique, também marcar todos os timeouts pendentes daquela `execution_id` como `processed: true`

### 3. `src/hooks/useFlowExecutions.ts`
- No `cancel` mutation, também marcar timeouts pendentes da execução como `processed: true`

