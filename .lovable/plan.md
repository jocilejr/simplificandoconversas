

## Substituir Evolution API por conexão direta com Baileys

### Problema
O frontend ainda usa `useEvolutionInstances` que lê da tabela `evolution_instances` e chama `supabase.functions.invoke("evolution-proxy")`. O edge function `execute-flow` ainda exige `evolution_api_url` e `evolution_api_key` do perfil. Tudo isso precisa ser limpo para usar apenas o Baileys na VPS.

### Arquitetura atual (VPS)
- Nginx intercepta `/functions/v1/` → Express backend (porta 3001)
- Express backend (`evolution-proxy.ts`) fala com Baileys service (porta 8084) usando `BAILEYS_URL` e `BAILEYS_API_KEY` (variáveis de ambiente do Docker)
- O frontend NÃO precisa de URL ou API key — o backend resolve tudo internamente

### Plano de alterações

**1. Renomear hook: `useEvolutionInstances.ts` → `useWhatsAppInstances.ts`**
- Renomear interface `EvolutionInstance` → `WhatsAppInstance`
- Manter mesma lógica (chama `evolution-proxy` que é a rota no Nginx → Express → Baileys)
- Tabela continua `evolution_instances` (renomear tabela é arriscado, tem FK e RLS)

**2. Atualizar `ConnectionsSection.tsx`**
- Importar de `useWhatsAppInstances`
- Sem outras mudanças visuais (já está limpo)

**3. Atualizar `FlowEditor.tsx`, `ManualFlowTrigger.tsx`, `Conversations.tsx`**
- Trocar import `useEvolutionInstances` → `useWhatsAppInstances`

**4. Reescrever `supabase/functions/execute-flow/index.ts` (parte crítica)**
- Remover dependência de `evolution_api_url` e `evolution_api_key` do perfil
- Usar `BAILEYS_URL` e `BAILEYS_API_KEY` de variáveis de ambiente (Deno.env)
- Isso é idêntico ao que o Express backend faz — o edge function fala direto com Baileys
- Mudar parâmetro `evolution_instance_name` → pegar do `bodyInstanceName` ou da tabela `evolution_instances`
- Remover checagem que retorna 400 "Evolution API not configured"

**5. Limpar `deploy/backend/src/routes/evolution-proxy.ts`**
- Remover leitura de `evolution_api_url`/`evolution_api_key` do perfil (já usa env vars)
- Remover referência a `evolution_instance_name` do perfil — usar apenas a instância passada no body ou da tabela

**6. Não alterar**
- Tabela `evolution_instances` (renomear exigiria migration + atualizar RLS + backend)
- Nginx config (já funciona)
- Baileys service (já funciona)
- Rota `evolution-proxy` no Express (o nome da rota não importa, é interno)

### Resultado
- Zero referências a "Evolution" no frontend visível ao usuário
- Edge function `execute-flow` funciona sem credenciais Evolution no perfil
- Tudo conecta diretamente com Baileys via variáveis de ambiente do servidor

