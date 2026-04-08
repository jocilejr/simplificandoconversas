

# Redesign Conexões WhatsApp — Layout profissional com números reais

## Problema
1. O número de telefone conectado a cada instância **não é exibido** — a tela de Conexões só mostra o nome da instância
2. O layout atual é uma lista simples de divs, sem hierarquia visual clara

## Solução

### 1. Backend: Incluir número de telefone no `fetch-instances`
**Arquivo:** `deploy/backend/src/routes/whatsapp-proxy.ts`

No case `fetch-instances`, após obter o `connectionState`, também buscar os dados da instância via `GET /instance/fetchInstances?instanceName=...` para extrair o `ownerJid` e `profileName`. Retornar esses campos no objeto de cada instância:

```typescript
// Para cada instância, buscar também ownerJid
const fetchResult = await evolutionRequest(
  `/instance/fetchInstances?instanceName=${encodeURIComponent(name)}`, "GET"
);
const instData = Array.isArray(fetchResult) ? fetchResult[0] : fetchResult;
const ownerJid = instData?.ownerJid || "";
const profileName = instData?.profileName || "";
const profilePicUrl = instData?.profilePicUrl || "";

return { name, status, ownerJid, profileName, profilePicUrl };
```

### 2. Frontend: Atualizar interface e hook
**Arquivo:** `src/hooks/useWhatsAppInstances.ts`

- Adicionar `ownerJid` e `profilePicUrl` ao `RemoteInstance`
- Atualizar `parseRemoteInstance` para extrair esses campos
- Propagar via `mergedInstances`

### 3. Frontend: Redesign completo do layout
**Arquivo:** `src/components/settings/ConnectionsSection.tsx`

Novo layout com cards profissionais em grid:

```text
┌──────────────────────────────────────────────────┐
│  ● Número Backup dos Grupos                      │
│  📱 +55 89 8804-2998  ·  Meire Rosana            │
│  [Conectada] [Ativa]                             │
│                                                  │
│  [Reconexão] [Sincronizar] [Fila] [⚙️] [🗑️]     │
│  ┌─ Fila ────────────────── Vazia ─┐             │
│  └─────────────────────────────────┘             │
└──────────────────────────────────────────────────┘
```

Mudanças visuais:
- Cards com `Card` component em vez de divs com bordas
- Número de telefone formatado abaixo do nome da instância (formato `+55 89 8804-2998`)
- Nome do perfil WhatsApp (`profileName`) ao lado do número
- Avatar/foto de perfil quando disponível (`profilePicUrl`)
- Botões de ação organizados em uma linha clara com separadores
- Indicador de status com cor e label mais visíveis
- Badge "Ativa" com destaque dourado consistente com o design do app

### Função utilitária para formatar telefone
Converter `558988042998@s.whatsapp.net` em `+55 89 8804-2998`:
```typescript
function formatPhoneDisplay(ownerJid: string): string {
  const digits = ownerJid.replace(/@.*/, "").replace(/\D/g, "");
  if (digits.length === 12) // 55 + DDD(2) + 8 dígitos
    return `+${digits.slice(0,2)} ${digits.slice(2,4)} ${digits.slice(4,8)}-${digits.slice(8)}`;
  if (digits.length === 13) // 55 + DDD(2) + 9 dígitos
    return `+${digits.slice(0,2)} ${digits.slice(2,4)} ${digits.slice(4,9)}-${digits.slice(9)}`;
  return `+${digits}`;
}
```

## Resumo de arquivos alterados
1. `deploy/backend/src/routes/whatsapp-proxy.ts` — buscar ownerJid/profileName/profilePicUrl
2. `src/hooks/useWhatsAppInstances.ts` — propagar novos campos
3. `src/components/settings/ConnectionsSection.tsx` — redesign completo com cards profissionais e número visível

