

## Corrigir IA — Ler chave OpenAI da tabela correta

### Problema
A rota `/ai-context` (e `/offer-pitch`) busca a chave OpenAI em `openai_settings.api_key`, mas a chave é salva em `profiles.openai_api_key`. Todas as outras rotas do backend (webhook, execute-flow, email) leem de `profiles` corretamente. Por isso `OPENAI=MISSING` no diagnóstico.

### Correção em `deploy/backend/src/routes/member-access.ts`

Nas duas rotas (`/ai-context` ~linha 174 e `/offer-pitch` ~linha 289), trocar a query de `openai_settings` para `profiles`:

**Rota /ai-context (~linha 174-183)**:
```typescript
// DE:
sb.from("openai_settings").select("api_key").eq("workspace_id", workspaceId).maybeSingle()

// PARA:
sb.from("profiles").select("openai_api_key").eq("workspace_id", workspaceId).maybeSingle()
```
E ajustar a leitura da chave:
```typescript
// DE:
if (!openaiRes.data?.api_key) throw new Error("OpenAI API key not configured.");
const OPENAI_API_KEY = openaiRes.data.api_key;

// PARA:
if (!openaiRes.data?.openai_api_key) throw new Error("OpenAI API key not configured.");
const OPENAI_API_KEY = openaiRes.data.openai_api_key;
```

**Rota /offer-pitch (~linha 289-298)** — mesma correção.

### Após aprovar

Rebuild na VPS:
```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

Teste:
```bash
cd ~/simplificandoconversas/deploy
MEMBER_DOMAIN=$(grep '^MEMBER_DOMAIN=' .env | cut -d= -f2-)
curl -skS -X POST "https://$MEMBER_DOMAIN/api/member-access/ai-context" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Teste","products":[],"ownedProductNames":[],"progress":[],"profile":{},"workspaceId":"65698ec3-731a-436e-84cf-8997e4ed9b41"}' | python3 -m json.tool
```

Deve retornar `{"greeting":"..."}` com texto gerado pela IA.

