

## Fix: TypeScript `unknown` type errors no backend

Todos os 16 erros são do mesmo tipo: acessar propriedades em valores tipados como `unknown` (retorno de `fetch().json()` e `baileysRequest`).

### Causa raiz

No TypeScript 4.9+, `Response.json()` retorna `Promise<any>` **apenas** quando `"DOM"` está no `lib`. Porém a função `baileysRequest` retorna `resp.json()` sem tipo explícito, e o TS infere `unknown` em alguns contextos.

### Correções (3 arquivos)

1. **`deploy/backend/src/routes/evolution-proxy.ts`** — Tipar retorno de `baileysRequest` como `Promise<any>`:
   ```typescript
   async function baileysRequest(path: string, method: string = "POST", body?: any): Promise<any> {
   ```

2. **`deploy/backend/src/routes/execute-flow.ts`** — Mesmo padrão: localizar a função `baileysRequest` (se duplicada) e tipar como `Promise<any>`. Adicionar `as any` nos `.json()` restantes:
   - Linha 195: `const userData: any = await userResp.json();`
   - Linha 393: `const aiData: any = await aiResp.json();`

3. **`deploy/backend/src/routes/webhook.ts`** — Cast no `.json()` da linha 36:
   - `const result: any = await resp.json();`

### Resultado

Zero erros de compilação. Nenhuma mudança de lógica — apenas anotações de tipo.

