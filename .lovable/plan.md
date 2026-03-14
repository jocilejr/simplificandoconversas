

## Corrigir "Unauthorized" na extensao

### Causa Raiz

O `extension-api.ts` usa `jwt.verify(token, JWT_SECRET)` (biblioteca jsonwebtoken) para validar o token. O GoTrue assina com **ES256** (assimetrico), mas o `jwt.verify` tenta validar com HS256 usando a secret simetrica -- falha sempre.

Enquanto isso, o `whatsapp-proxy.ts` (linhas 73-79) valida corretamente chamando `GET ${GOTRUE_URL}/user` com o Bearer token, delegando a validacao ao proprio GoTrue.

### Correcao

**Arquivo: `deploy/backend/src/routes/extension-api.ts`**

Substituir a validacao JWT local pelo mesmo padrao do `whatsapp-proxy.ts`:

1. Remover `import jwt` e `const JWT_SECRET`
2. Reescrever `extractUserId` como funcao async que chama `GET ${GOTRUE_URL}/user` com o Bearer token
3. Tornar `requireAuth` async
4. Atualizar todas as rotas para usar `await requireAuth(req, res)`

Codigo do novo `extractUserId`:
```typescript
const GOTRUE_URL = process.env.GOTRUE_URL || "http://gotrue:9999";

async function extractUserId(req: Request): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const resp = await fetch(`${GOTRUE_URL}/user`, {
      headers: { Authorization: auth },
    });
    if (!resp.ok) return null;
    const user: any = await resp.json();
    return user.id || null;
  } catch {
    return null;
  }
}
```

### Apos deploy
```bash
docker compose build backend && docker compose up -d --force-recreate backend
```

