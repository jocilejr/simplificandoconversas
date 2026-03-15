

## Diagnóstico: Pixel Meta não dispara no fluxo

O código do backend (`deploy/backend/src/routes/execute-flow.ts`) busca as credenciais do pixel na tabela `meta_pixels` via PostgREST. Porém:

1. **O erro da query é ignorado silenciosamente**: A desestruturação `const { data: pixelRow }` descarta o campo `error`. Se PostgREST retorna 404 (tabela não visível no cache), `pixelRow` é `null` e o log mostra apenas "credenciais não configuradas" -- sem revelar que o problema real é a tabela não existir.

2. **Causa raiz**: O mesmo problema de cache do PostgREST que causa o 404 no frontend também afeta o backend. O `serviceClient` do backend também usa PostgREST.

## Correções

### 1. Adicionar log de erro na query de meta_pixels (execute-flow.ts)

Nos dois trechos (standalone e group), capturar `error` da query e logar:

```typescript
const { data: pixelRow, error: pixelQueryError } = await serviceClient
  .from("meta_pixels")
  .select(...)
  ...
if (pixelQueryError) {
  console.error(`[execute-flow] metaPixel query error:`, JSON.stringify(pixelQueryError));
  results.push(`metaPixel: error - falha ao buscar pixel: ${pixelQueryError.message}`);
}
```

Isso se aplica tanto ao bloco standalone (linha ~455) quanto ao bloco group (linha ~677).

### 2. Rodar update.sh atualizado na VPS

As correções anteriores do `update.sh` (NOTIFY pgrst + restart postgrest + validação da tabela) resolvem a causa raiz. O usuário precisa rodar o update na VPS para que tanto o frontend quanto o backend consigam acessar `meta_pixels`.

## Resultado Esperado

- Após rodar `update.sh`: PostgREST recarrega schema, tanto frontend quanto backend enxergam `meta_pixels`.
- Se ainda falhar: logs do Docker do backend mostrarão o erro real da query, facilitando diagnóstico.

