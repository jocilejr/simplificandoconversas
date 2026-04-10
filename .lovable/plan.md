
Problema confirmado: o erro não é mais falta de rebuild. O backend está ativo e a rota responde. O bug agora é de leitura da chave.

O que encontrei no código:
- `src/hooks/useProfile.ts` salva a chave em `profiles.openai_api_key` filtrando por `user_id`
- `src/components/settings/AISection.tsx` também lê a chave do `profile`
- porém `deploy/backend/src/routes/member-access.ts` está tentando ler `profiles.openai_api_key` com `.eq("workspace_id", workspaceId)`
- a tabela `profiles` não tem `workspace_id`
- a tabela `workspaces` tem `created_by` e também tem `openai_api_key`

Conclusão:
- a rota da área de membros está consultando a tabela certa com o filtro errado
- por isso sempre cai em `OpenAI API key not configured.` mesmo com chave salva

Correção exata a aplicar:
1. Em `deploy/backend/src/routes/member-access.ts`
- nas duas rotas:
  - `POST /ai-context`
  - `POST /offer-pitch`
- parar de consultar:
  - `profiles` por `workspace_id`
- e passar a resolver a chave assim:
  1. buscar o workspace em `workspaces` por `id`
  2. pegar `created_by` e `openai_api_key`
  3. se `workspaces.openai_api_key` existir, usar ela
  4. senão buscar em `profiles.openai_api_key` por `user_id = workspaces.created_by`
  5. se ainda não existir, retornar erro

Código exato que deve substituir a resolução atual da chave nas duas rotas:
```ts
const { data: workspaceRow, error: workspaceError } = await sb
  .from("workspaces")
  .select("created_by, openai_api_key")
  .eq("id", workspaceId)
  .maybeSingle();

if (workspaceError || !workspaceRow) {
  return res.status(404).json({ error: "Workspace not found." });
}

let OPENAI_API_KEY = workspaceRow.openai_api_key || "";

if (!OPENAI_API_KEY && workspaceRow.created_by) {
  const { data: profileRow, error: profileError } = await sb
    .from("profiles")
    .select("openai_api_key")
    .eq("user_id", workspaceRow.created_by)
    .maybeSingle();

  if (profileError) {
    return res.status(500).json({ error: profileError.message || "Error loading OpenAI API key." });
  }

  OPENAI_API_KEY = profileRow?.openai_api_key || "";
}

if (!OPENAI_API_KEY) {
  return res.status(500).json({ error: "OpenAI API key not configured." });
}
```

2. Remover este trecho incorreto nas duas rotas
```ts
sb.from("profiles").select("openai_api_key").eq("workspace_id", workspaceId).maybeSingle()
```

3. Manter a leitura de `member_area_settings` por `workspace_id`
- isso está correto
- o problema é só a chave

Depois da alteração, na VPS você vai rodar exatamente isto:
```bash
cd ~/simplificandoconversas/deploy
docker compose up -d --build backend
```

Depois testar exatamente isto:
```bash
cd ~/simplificandoconversas/deploy
MEMBER_DOMAIN=$(grep '^MEMBER_DOMAIN=' .env | cut -d= -f2-)
curl -skS -X POST "https://$MEMBER_DOMAIN/api/member-access/ai-context" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Teste","products":[],"ownedProductNames":[],"progress":[],"profile":{},"workspaceId":"65698ec3-731a-436e-84cf-8997e4ed9b41"}' | python3 -m json.tool
```

Resultado esperado:
- não deve mais voltar `OpenAI API key not configured.`
- deve voltar algo como:
```json
{
  "greeting": "..."
}
```

Se aprovar, eu preparo a alteração exata nesse arquivo.
