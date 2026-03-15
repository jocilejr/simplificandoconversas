

## Diagnóstico

A screenshot mostra que na VPS o `POST /rest/v1/meta_pixels` retorna **404**, e o console exibe `[addPixel] Insert error: {}` -- o objeto de erro do Supabase está vazio. Por isso `parseSupabaseError` retorna "Erro desconhecido" com status/details undefined.

O problema tem duas camadas:

1. **VPS**: PostgREST ainda não enxerga `meta_pixels` (o `update.sh` com as correções de NOTIFY + restart pode não ter sido rodado ainda, ou o deploy anterior falhou antes dessa etapa).

2. **Frontend**: O erro retornado pelo Supabase client para 404 é um objeto vazio `{}`, então o parser não consegue extrair informação útil. Precisamos capturar o status HTTP diretamente do response.

## Correção no Frontend

**Arquivo: `src/hooks/useMetaPixels.ts`**

Alterar o `addPixel.mutationFn` para verificar o `status` e `statusText` da resposta, não apenas o `error` object. Usar `.select()` no insert para obter a resposta completa, e checar manualmente o HTTP status:

```typescript
const res = await supabase
  .from("meta_pixels")
  .insert({ ...pixel, user_id: user.id })
  .select();

if (res.error) {
  console.error("[addPixel] Insert error:", JSON.stringify(res.error));
  // Attach HTTP status if available
  const err: any = res.error;
  err._httpStatus = res.status;
  throw err;
}
```

Atualizar `parseSupabaseError` para extrair `_httpStatus` ou checar se `code` contém "PGRST":

```typescript
function parseSupabaseError(err: unknown): { message: string; status?: number; details?: string } {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const message = (e.message as string) || "Erro desconhecido";
    const httpStatus = (e._httpStatus as number) || undefined;
    const code = e.code as string;
    const status = httpStatus || (typeof e.status === "number" ? e.status : undefined);
    const details = (e.details as string) || (e.hint as string) || undefined;
    
    // Detect 404 from PGRST code or empty error on non-200 status
    if (code?.startsWith("PGRST") || (status && status >= 400)) {
      return { message: message || `HTTP ${status}`, status, details };
    }
    return { message, status, details };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
}
```

Aplicar o mesmo padrão `.select()` + `res.status` nos mutations `updatePixel` e `deletePixel`.

Além disso, usar `JSON.stringify` nos `console.error` para garantir que objetos vazios/circulares sejam visíveis.

## Resultado Esperado

- Na VPS após rodar `update.sh` atualizado: tabela visível, insert funciona.
- Se PostgREST ainda retornar 404: toast mostra "Tabela de pixels não disponível no backend. Rode o update da VPS novamente." em vez de "Erro desconhecido".
- Console mostra dados estruturados para debug.

