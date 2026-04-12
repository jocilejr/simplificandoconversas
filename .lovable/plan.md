
Corrigi o diagnóstico: o problema não está mais apenas nas functions do backend integrado. Na sua VPS ainda existe um segundo fluxo antigo gerando a mensagem com regras femininas.

O que encontrei no código da VPS
- `deploy/backend/src/routes/member-access.ts` ainda contém o gerador real usado pela sua VPS:
  - fallback `Nome: ${firstName || "Querido(a)"}`
  - `replace(/\{firstName\}/g, firstName || "Querido(a)")`
  - categorias antigas como `novo/inativo/fiel`
  - prompt antigo com viés feminino
  - no route `/ai-context`, ele busca só `ai_persona_prompt, ai_model` e ignora `greeting_prompt`
- `src/pages/MemberAccess.tsx` ainda tem fallbacks femininos no frontend:
  - `"Bem-vinda à sua área exclusiva! 🎉"`
  - `"Bem-vindo(a) à sua área exclusiva!"`
  - `firstName || "Querido(a)"`
- `src/pages/MemberAccess.tsx` também guarda a saudação em cache por 4 horas no `localStorage`, então mesmo corrigindo o backend, a frase antiga pode continuar aparecendo por horas.
- `src/components/membros/LockedOfferCard.tsx` ainda envia `firstName || "Querido(a)"` para a VPS no pitch de oferta.

Plano de correção
1. Atualizar o gerador da VPS em `deploy/backend/src/routes/member-access.ts`
- Fazer `/ai-context` ler `greeting_prompt` junto com `ai_persona_prompt`
- Se existir `greeting_prompt`, usar ele como base do prompt
- Remover todos os fallbacks `Querido(a)`
- Trocar categorias por versões neutras, por exemplo:
  - `novo` -> `recente`
  - `inativo` -> `ausente`
- Reforçar no prompt e na tool description:
  - nunca usar `querido/querida`, `bem-vindo/bem-vinda`
  - usar somente o nome direto ou expressão neutra

2. Corrigir também o `/offer-pitch` da VPS
- Remover `replace(... firstName || "Querido(a)")`
- Reforçar neutralidade de gênero no system prompt e no user prompt
- Garantir que o pitch use nome direto mesmo sem primeiro nome confiável

3. Corrigir os fallbacks do frontend
- Em `src/pages/MemberAccess.tsx`:
  - remover `"Bem-vinda à sua área exclusiva! 🎉"`
  - remover `"Bem-vindo(a) à sua área exclusiva!"`
  - remover fallback `Querido(a)`
  - trocar por opções neutras como:
    - `"Sua área exclusiva"`
    - `"Boas-vindas à sua área exclusiva!"`
- Em `src/components/membros/LockedOfferCard.tsx`:
  - não enviar `Querido(a)` como fallback
  - enviar string vazia ou o primeiro nome somente quando existir

4. Invalidar o cache local da saudação
- Alterar a chave `AI_CACHE_KEY` ou adicionar versionamento
- Assim a saudação antiga não continua vindo do navegador por 4 horas após a correção

5. Verificação na sua VPS
Depois da implementação, vou te pedir para testar dentro da VPS assim:
```bash
curl -s -X POST "http://SEU_BACKEND:3001/api/member-access/ai-context" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName":"Wanderley",
    "products":[{"name":"Manuscrito do Arcanjo Miguel","materials":["Capítulo 1"]}],
    "ownedProductNames":["Manuscrito do Arcanjo Miguel"],
    "progress":[],
    "profile":{"memberSince":"2026-04-10T00:00:00.000Z","totalPaid":0,"totalProducts":1,"daysSinceLastAccess":0},
    "workspaceId":"SEU_WORKSPACE_ID",
    "phone":"5581999999999"
  }'
```
E confirmar que:
- não sai `Querida Wanderley`
- não sai `bem-vinda`
- a saudação usa o nome diretamente

Arquivos a alterar
- `deploy/backend/src/routes/member-access.ts`
- `src/pages/MemberAccess.tsx`
- `src/components/membros/LockedOfferCard.tsx`

Resultado esperado
- a VPS passa a respeitar o `greeting_prompt`
- o frontend não injeta mais termos de gênero
- o cache antigo não reaproveita mensagens femininas já geradas
- “Querida Wanderley” deixa de aparecer mesmo no fluxo real da sua VPS
