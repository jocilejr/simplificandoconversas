

## Remover Evolution API completamente — usar apenas Baileys

### Problema atual
O edge function `evolution-proxy` (1037 linhas) ainda contém toda a lógica da Evolution API. Quando roda no Lovable Cloud, ele tenta ler `evolution_api_url` e `evolution_api_key` do perfil e retorna erro 400 quando não encontra. Na VPS, o Nginx intercepta a rota e encaminha para o Express backend (que fala com Baileys), então o edge function nunca é chamado lá — mas ele precisa existir para o código compilar.

### Plano

**1. Reescrever `supabase/functions/evolution-proxy/index.ts`**
- Reduzir de 1037 linhas para ~30 linhas
- Retornar uma resposta simples informando que a funcionalidade requer o backend self-hosted (Baileys)
- Manter CORS headers e estrutura básica para não quebrar chamadas do frontend
- Na VPS isso nunca será chamado (Nginx intercepta antes)

**2. Remover `supabase/functions/evolution-webhook/index.ts`**
- O webhook da Evolution API não é mais necessário — Baileys envia webhooks diretamente para o Express backend

**3. Limpar `src/hooks/useEvolutionInstances.ts`**
- Remover a chamada `set-webhook` do `setActiveInstance` (Baileys gerencia webhooks internamente)

**4. Limpar `src/hooks/useProfile.ts`**
- Remover `evolution_instance_name` do `updateProfile` (não é mais necessário sincronizar com profile)
- Remover `testConnection` mutation (usava Evolution API)

**5. Limpar `src/pages/Conversations.tsx`**
- Verificar se `sync-chats` ainda faz sentido (na VPS vai para Express/Baileys, no Cloud retornará erro informativo)

### Arquivos que NÃO mudam
- `src/components/settings/ConnectionsSection.tsx` — já está limpo
- `src/components/settings/AppSection.tsx` — já está limpo
- `deploy/backend/*` — backend Express/Baileys continua funcionando igual

### Resultado
- Zero referências à Evolution API no código
- Edge function serve apenas como stub (na VPS nunca é chamado)
- Frontend continua chamando `supabase.functions.invoke("evolution-proxy")` que no VPS é interceptado pelo Nginx → Express → Baileys

