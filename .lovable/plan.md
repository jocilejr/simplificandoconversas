NÃO DEVE SER POSSIVEL VINCULAR INSTANCIAS DE OUTRO WORKSPACE. CADA WORKSPACE TEM SUAS INSTANCIAS CONECTADAS, NUNCA DEVO PODER CONSEGUIR VER A INSTANCIAS DE OUTRO WORKSPACE. INDIVIDUALIZE TUDO  
  
Investigação: Configurações lentas para carregar

## Diagnóstico

O problema tem duas causas principais:

1. `**useProfile()` chamado no nível da página** — executa `supabase.auth.getUser()` a cada navegação para Settings, mesmo que o perfil já esteja em cache. Não tem `staleTime`, então refaz a query toda vez.
2. **Aba padrão "Conexões" carrega edge function lenta** — `useWhatsAppInstances` chama `supabase.functions.invoke("whatsapp-proxy")` que na VPS faz proxy para o backend Express. Se o backend demorar ou o timeout for alto, a página inteira fica travada no spinner do `useProfile` + a aba padrão fica lenta.
3. **Queries sem `staleTime**` — `useProfile`, `useAIConfig`, `useSmtpConfig` não têm `staleTime` individual, forçando refetch desnecessário toda vez que o usuário navega para Settings.

## Plano de correção

### 1. Adicionar `staleTime` aos hooks de Settings

- `**useProfile.ts**`: Adicionar `staleTime: 60_000` (1 min)
- `**useAIConfig.ts**`: Adicionar `staleTime: 60_000`
- `**useSmtpConfig.ts**`: Adicionar `staleTime: 60_000`

### 2. Mudar aba padrão para "profile"

- `**SettingsPage.tsx**`: Trocar `useState("connections")` por `useState("profile")`
- A aba Perfil carrega apenas dados locais (profile), muito mais rápido
- Conexões (WhatsApp) fica sob demanda quando o usuário clicar

### 3. Adicionar timeout à query de instâncias remotas

- `**useWhatsAppInstances.ts**`: Usar `AbortSignal.timeout(8000)` na chamada `supabase.functions.invoke` para não travar a UI por mais de 8 segundos

### 4. Não bloquear renderização no loading do profile

- `**SettingsPage.tsx**`: Remover o spinner de tela cheia baseado em `isLoading` do profile — renderizar o layout imediatamente e deixar cada seção mostrar seu próprio loading

### Arquivos modificados

- `src/hooks/useProfile.ts` — staleTime
- `src/hooks/useAIConfig.ts` — staleTime
- `src/hooks/useSmtpConfig.ts` — staleTime  
- `src/pages/SettingsPage.tsx` — aba padrão + remover spinner bloqueante
- `src/hooks/useWhatsAppInstances.ts` — timeout na query remota