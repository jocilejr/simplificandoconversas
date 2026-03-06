

## Adaptar 100% para VPS — Conexão automática com Baileys

### Situação atual
A arquitetura já funciona na VPS: o frontend chama `supabase.functions.invoke("evolution-proxy")` → Nginx intercepta `/functions/v1/` → Express backend (`/api/evolution-proxy`) → Baileys service (porta 8084). O problema é que a UI não faz polling automático e depende de cliques manuais para buscar status.

### Alterações

**1. `src/hooks/useWhatsAppInstances.ts` — Auto-polling com query**
- Converter `fetchRemoteInstances` de mutation para uma `useQuery` com `refetchInterval: 10000` (10s)
- O query chama `supabase.functions.invoke("evolution-proxy", { body: { action: "fetch-instances" } })` automaticamente
- Expor `remoteInstances` e `isServerConnected` (true se a chamada não retornar 503)
- Manter mutations para create, connect, delete, setActive

**2. `src/components/settings/ConnectionsSection.tsx` — UI simplificada**
- Remover `useEffect` manual e state `remoteInstances` — usar dados do hook diretamente
- Remover Dialog "Buscar Instâncias" — mostrar tudo inline na página
- Adicionar indicador de status do servidor no topo (verde = conectado ao Baileys, vermelho = servidor offline)
- Botão "Nova Instância" direto no header
- Lista de instâncias com status em tempo real (atualiza a cada 10s)
- QR Code aparece inline quando clicar "Conectar"
- Quando não há instâncias, mostrar botão direto para criar

```text
┌──────────────────────────────────────────────┐
│  Conexões WhatsApp        ● Servidor online  │
│                              [+ Nova]        │
├──────────────────────────────────────────────┤
│  ● sc-abc123    Conectada    [★ Ativa]       │
│  ○ sc-def456    Desconectada [Conectar][×]   │
├──────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐     │
│  │         QR Code (se ativo)          │     │
│  │     Escaneie para conectar          │     │
│  └─────────────────────────────────────┘     │
└──────────────────────────────────────────────┘
```

### Arquivos alterados
- `src/hooks/useWhatsAppInstances.ts`
- `src/components/settings/ConnectionsSection.tsx`

### O que NÃO muda
- `supabase.functions.invoke()` continua sendo usado como transporte (Nginx intercepta na VPS)
- Express backend / Baileys service / Nginx config
- Edge functions (stubs que nunca são chamados na VPS)
- Tabela `evolution_instances` (nome interno, sem impacto visual)

