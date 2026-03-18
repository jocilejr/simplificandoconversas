

## Diagnóstico: MetaPixel Não Dispara para Todos

### O que os dados mostram
- Nos logs (`--since 1h`), apenas 1 execução do metaPixel apareceu (contato `5527999235418`)
- As execuções completadas mais antigas (antes da janela de 1h) não aparecem nos logs, então não sabemos se dispararam ou não
- A coluna `results` está vazia na maioria das execuções completadas

### Causa raiz da falta de visibilidade
Linha 795 de `execute-flow.ts`:
```javascript
.eq("id", executionId).eq("status", "running")
```
Quando o fluxo é retomado (após click), a execução anterior foi marcada como `completed` pelo `link-redirect.ts`, e uma NOVA execução é criada com status `running`. Porém, se qualquer nó intermediário (waitForReply, waitForClick) alterar o status durante o processamento, o `results` final nunca é salvo porque o `.eq("status", "running")` não encontra a row. Isso explica por que a maioria das execuções completadas tem `results` vazio -- perdemos toda a auditoria.

### Plano de Correção

**Arquivo:** `deploy/backend/src/routes/execute-flow.ts`

1. **Corrigir persistência de results** (linha 795): Remover `.eq("status", "running")` e usar apenas `.eq("id", executionId)` para garantir que os results SEMPRE sejam salvos, independente do status atual.

2. **Adicionar log de entrada por step do grupo** (dentro do loop linha 630): Antes de processar cada step, logar `[execute-flow] Group step ${si+1}/${total}: type=${step.data.type}` para rastrear exatamente quais steps são alcançados.

3. **Try-catch individual por step do grupo**: Envolver cada step em seu próprio try-catch para que a falha de um (ex: erro de rede na Meta API) não impeça os seguintes de executar. Atualmente todos os steps compartilham um único try-catch externo (linha 400/782).

4. **Paridade na Edge Function:** `supabase/functions/execute-flow/index.ts` -- aplicar as mesmas 3 correções.

### Resultado esperado
- `results` sempre salvo --> possibilidade de auditar se o metaPixel disparou ou não para cada contato
- Log por step --> identificar exatamente onde o fluxo falha quando falhar
- Try-catch individual --> garantir que metaPixel execute mesmo se um step anterior falhar

