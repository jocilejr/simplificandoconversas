

## Problema

O webhook chama `execute-flow` via `fetch` e faz `await resp.json()` — ou seja, espera o fluxo inteiro terminar (que leva 6+ segundos com sendText + 3s de delay + sendVideo). O runtime do webhook pode ser encerrado antes disso, interrompendo a execucao. O resultado: o registro fica preso com `status = 'running'` eternamente, e a verificacao de duplicatas impede novas execucoes para o mesmo contato + fluxo.

## Plano

### 1. Webhook — fire-and-forget

No `evolution-webhook/index.ts`, trocar o `await fetch(...)` + `await resp.json()` por um fire-and-forget:

```js
// Antes (bloqueia):
const resp = await fetch(url, opts);
const result = await resp.json();

// Depois (fire-and-forget):
fetch(url, opts)
  .then(r => r.json())
  .then(r => console.log("Flow result:", r))
  .catch(e => console.error("Flow call error:", e));
```

### 2. Execute-flow — adicionar logs de debug

Adicionar `console.log` em pontos-chave do `execute-flow/index.ts`:
- Ao iniciar execucao
- Ao processar cada no/child
- Ao completar ou falhar
- Resultado de cada chamada a Evolution API

### 3. Limpar execucao travada

Atualizar o registro preso (`f02d1b50...`) para `status = 'completed'` via migracao, e adicionar logica de auto-cleanup: ao criar uma nova execucao, cancelar automaticamente execucoes "running" com mais de 5 minutos (provavelmente travadas).

### Arquivos impactados

- **Editar**: `supabase/functions/evolution-webhook/index.ts` (fire-and-forget)
- **Editar**: `supabase/functions/execute-flow/index.ts` (logs + cleanup de execucoes travadas)

