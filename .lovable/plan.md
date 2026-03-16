

## Correção: Erros de compilação TypeScript (`as any` casts)

O build falhou porque `metaResp.json()` retorna `Promise<unknown>` no Node 20, e acessamos `.error` / `.message` sem cast. Conforme a memória do projeto, precisamos de `as any` explícito.

### Alterações

**1. `deploy/backend/src/routes/execute-flow.ts`**

- Linha 495: `const metaResult = await metaResp.json();` → `const metaResult = (await metaResp.json()) as any;`
- Linha 713: mesma correção no bloco de grupo

**2. `deploy/backend/src/routes/health-db.ts`**

- Linha 38: `const metaResult = await metaResp.json();` → `const metaResult = (await metaResp.json()) as any;`

### Nota sobre o PM2

A saída do `ss` confirma que **PM2** (pid 599207) está escutando na porta 3001 do host. Esse é o processo legado que retorna "Token não fornecido". Após o fix de compilação e rebuild, você pode matá-lo:

```bash
pm2 stop all && pm2 delete all
```

Ou simplesmente ignorá-lo e testar sempre via `docker compose exec backend wget ...`.

