

## Bug: "Capturar Resposta" (waitForReply) não funciona dentro de groupBlock

### Causa raiz

No handler de `groupBlock` (linha 629-632 do `execute-flow`), apenas `waitForClick` tem tratamento especial para pausar o fluxo. O `waitForReply` cai no `else` genérico e é executado como um step comum via `executeStep()`, que não sabe pausar — o fluxo simplesmente passa direto.

Além disso, o código de retomada no `evolution-webhook` (função `checkAndResumeWaitingReply`) só procura nós standalone do tipo `waitForReply`. Se o nó está dentro de um grupo, ele nunca é encontrado.

### Solução

**1. `supabase/functions/execute-flow/index.ts`** — Adicionar handler para `waitForReply` dentro de grupos, similar ao que já existe para `waitForClick`:
- Antes do `else` genérico (linha 629), adicionar `else if (step.data.type === "waitForReply")`
- Pausar a execução com status `waiting_reply`
- Inserir timeout se configurado
- Marcar `groupPaused = true` e dar `break`

**2. `supabase/functions/evolution-webhook/index.ts`** — Atualizar `checkAndResumeWaitingReply` para encontrar `waitForReply` dentro de groupBlocks:
- Além de procurar nós com `data.type === "waitForReply"`, iterar sobre nós com `data.type === "groupBlock"` e verificar se algum step interno é `waitForReply`
- Usar a saída correta do grupo (output-0) como `nextNodeId`

### Arquivos alterados
- `supabase/functions/execute-flow/index.ts` — handler de waitForReply em groupBlock
- `supabase/functions/evolution-webhook/index.ts` — busca de waitForReply em grupos na retomada

