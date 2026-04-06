

# Fix: Erro de TypeScript no build do backend

## Problema
Linha 322 de `analyze-csv-contacts.ts`: `response.json()` retorna `unknown` no TypeScript strict, e acessar `.choices` falha com `TS2339`.

## Solução
Adicionar type assertion `as any` no resultado do `response.json()`:

```typescript
const aiResult: any = await response.json();
```

## Arquivo a modificar
### `deploy/backend/src/routes/analyze-csv-contacts.ts`
- Linha 321: mudar `const aiResult = await response.json()` para `const aiResult: any = await response.json()`

Após aplicar, rodar `./update.sh` novamente na VPS.

