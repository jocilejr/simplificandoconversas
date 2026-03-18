

## Diagnóstico: Pixel Meta disparando para apenas 2 de 15+ contatos

### Problema Raiz

Pela imagem, o nó "Pixel Meta" está **dentro de um Grupo**, junto com "Ação" (tag parar-fluxo). O painel de propriedades mostra **"Pixel: Carregando..."** — isso indica que o `selectedPixelId` pode não estar persistido corretamente no JSON do fluxo.

Quando o backend processa o nó e `step.data.selectedPixelId` é `undefined` ou vazio, ele cai direto no erro silencioso:
```
metaPixel: error - Pixel ID ou Access Token não configurado
```

As 2 marcações que funcionaram provavelmente foram de um momento em que o pixel estava selecionado e o fluxo foi salvo corretamente.

### Problemas a Corrigir

**1. Log insuficiente — impossível diagnosticar remotamente**
O backend loga os resultados, mas não inclui o valor de `selectedPixelId` recebido. Precisamos de um log explícito mostrando o que chegou.

**2. Sem fallback para pixel único**
Se o usuário tem apenas 1 pixel configurado e o `selectedPixelId` não foi salvo no nó, o sistema deveria usar o pixel disponível automaticamente, em vez de falhar.

**3. Resultados de execução não são salvos no banco**
Os `results[]` são apenas logados no console e retornados no JSON da resposta HTTP. Não ficam salvos em `flow_executions`, dificultando auditoria.

### Plano de Implementação

**Arquivo: `deploy/backend/src/routes/execute-flow.ts`**

Em ambos os blocos de metaPixel (standalone ~linha 447 e group ~linha 680):

1. Adicionar log do `selectedPixelId` recebido:
```typescript
console.log(`[execute-flow] metaPixel: selectedPixelId=${data.selectedPixelId}, userId=${userId}`);
```

2. Adicionar fallback: se `selectedPixelId` estiver vazio/undefined, buscar o primeiro pixel do usuário:
```typescript
if (!data.selectedPixelId) {
  // Fallback: use first pixel for this user
  const { data: fallbackPixels } = await serviceClient
    .from("meta_pixels")
    .select("id, pixel_id, access_token")
    .eq("user_id", userId)
    .limit(1);
  if (fallbackPixels?.[0]) {
    pixelId = fallbackPixels[0].pixel_id;
    accessToken = fallbackPixels[0].access_token;
    console.log(`[execute-flow] metaPixel: using fallback pixel ${fallbackPixels[0].id}`);
  }
}
```

3. Salvar resultados na tabela `flow_executions` ao finalizar:
```typescript
await serviceClient.from("flow_executions")
  .update({ status: "completed", results })
  .eq("id", executionId).eq("status", "running");
```

Isso requer adicionar coluna `results` à tabela `flow_executions` (tipo `jsonb`, nullable, default `null`).

### Resumo das Alterações

| Arquivo | Mudança |
|---|---|
| `deploy/backend/src/routes/execute-flow.ts` | Fallback para pixel único + logs detalhados + salvar results |
| Migration SQL | Adicionar coluna `results jsonb` em `flow_executions` |

Após o deploy, rode na VPS:
```bash
docker compose logs backend --tail=200 2>&1 | grep "metaPixel"
```
Isso vai mostrar exatamente o que está falhando em cada execução.

