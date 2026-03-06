

## Remover Evolution API e usar apenas Baileys

### Contexto
A arquitetura self-hosted já roteia `/functions/v1/` → Express backend → Baileys. O frontend não precisa de credenciais Evolution API. As mudanças são puramente no frontend.

### Alterações

**1. `src/components/settings/ConnectionsSection.tsx`**
- Remover campos de credenciais Evolution API (URL Base, API Key) e o dialog "Servidor Evolution API"
- Remover a verificação `hasCredentials` que bloqueia a UI quando não há credenciais
- Remover seção de proxy (não se aplica ao Baileys)
- Instâncias ficam sempre visíveis e gerenciáveis
- Remover `useEffect` que carrega `apiUrl`/`apiKey` do profile

**2. `src/hooks/useProfile.ts`**
- Remover `evolution_api_url` e `evolution_api_key` do tipo de `updateProfile`
- Manter `evolution_instance_name` (ainda usado para identificar instância ativa)

**3. `src/hooks/useEvolutionInstances.ts`**
- Remover mutation `setProxy` (não aplicável)
- Remover `syncWebhooks` (auto-configurado no Baileys)

**4. `src/components/settings/AppSection.tsx`**
- Remover card do Webhook URL que referencia `evolution-webhook`

**5. `src/pages/Conversations.tsx`**
- Remover referência a `evolution-proxy` no texto, manter funcionalidade (a chamada `supabase.functions.invoke("evolution-proxy")` continua funcionando pois o nginx redireciona para o Express backend que fala com Baileys)

**6. `supabase/functions/evolution-proxy/index.ts`**
- Simplificar: remover checagem de `evolution_api_url`/`evolution_api_key` obrigatórias
- Adicionar fallback para quando essas credenciais não existem (cenário Baileys puro)

### Não será alterado
- A chamada `supabase.functions.invoke("evolution-proxy", ...)` permanece em todos os hooks — o nome é apenas uma rota, no self-hosted ela já vai para o Express/Baileys
- A tabela `evolution_instances` no banco permanece (funciona igual)
- O `deploy/backend/src/routes/evolution-proxy.ts` já está pronto para Baileys

