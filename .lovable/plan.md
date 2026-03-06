

## Plano: Corrigir erros de build TypeScript + Dockerfile

Os arquivos nunca receberam as correções anteriores. Vou aplicar as mudanças mínimas necessárias.

### Correções

**1. `deploy/baileys-service/Dockerfile`** (linha 3)
- Adicionar `RUN apk add --no-cache git` antes do `COPY package.json`
- Necessário porque `@whiskeysockets/baileys` instala via git

**2. `deploy/backend/src/routes/evolution-proxy.ts`** (2 linhas)
- Linha 16: `return resp.json();` → `return resp.json() as Promise<any>;`
  - Corrige erros nas linhas 29, 102, 195, 221 (todas usam resultado de `baileysRequest`)
- Linha 70: `const userData = await userResp.json();` → `const userData: any = await userResp.json();`
  - Corrige erro na linha 71

**3. `deploy/backend/src/routes/execute-flow.ts`** (2 linhas)
- Linha 195: `const userData = await userResp.json();` → `const userData: any = await userResp.json();`
  - Corrige erro na linha 196
- Linha 393: `const aiData = await aiResp.json();` → `const aiData: any = await aiResp.json();`
  - Corrige erro na linha 394
- As linhas 64, 79, 94, 109, 126, 400, 428, 484 usam `r?.key?.id` onde `r` vem de `baileysRequest`. Como `baileysRequest` no execute-flow.ts também tem o mesmo problema, preciso verificar essa função lá.

**4. `deploy/backend/src/routes/webhook.ts`** (1 linha)
- Linha 36: `const result = await resp.json();` → `const result: any = await resp.json();`
  - Corrige erro na linha 37

**5. `deploy/docker-compose.yml`** (1 linha)
- Remover `version: "3.8"` para eliminar o warning

### Total: ~7 linhas alteradas em 5 arquivos

Após o push, rodar no servidor:
```bash
cd ~/simplificandoconversas && git pull origin main && cd deploy && docker compose build --no-cache && docker compose up -d
```

