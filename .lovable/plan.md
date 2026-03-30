

## Aba de Conexão com OpenPix nas Configurações

### Visão Geral
Adicionar uma nova aba "Integrações" (ou sub-aba dentro de Conexões) na página de Configurações para gerenciar credenciais de plataformas financeiras, começando pela OpenPix. O usuário poderá cadastrar seu App ID e Webhook Secret da OpenPix, que serão salvos no banco e usados pelo backend para validar webhooks recebidos.

### Banco de Dados

Criar tabela `platform_connections`:
- `id` uuid PK
- `user_id` uuid NOT NULL
- `platform` text NOT NULL (ex: "openpix", "mercadopago", "yampi")
- `credentials` jsonb NOT NULL DEFAULT '{}'  (armazena app_id, webhook_secret, access_token etc.)
- `enabled` boolean DEFAULT true
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()
- UNIQUE(user_id, platform)
- RLS: usuário autenticado gerencia seus próprios registros

### Frontend

1. **Criar `src/components/settings/IntegrationsSection.tsx`**
   - Lista de plataformas disponíveis (OpenPix primeiro, depois Mercado Pago, Yampi como "em breve")
   - Card da OpenPix com:
     - Status (conectada/desconectada) baseado na existência de credenciais
     - Campos: App ID, Webhook Secret
     - Botão Salvar / Desconectar
     - URL do webhook para copiar: `https://api.seudominio.com/api/webhook-transactions/openpix`
   - Hook `usePlatformConnections.ts` para CRUD na tabela

2. **Editar `src/pages/SettingsPage.tsx`**
   - Adicionar aba "Integrações" (grid-cols-5)
   - Importar e renderizar `IntegrationsSection`

### Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabela `platform_connections` |
| `src/hooks/usePlatformConnections.ts` | Hook para gerenciar conexões |
| `src/components/settings/IntegrationsSection.tsx` | UI da aba |
| `src/pages/SettingsPage.tsx` | Adicionar nova aba |

### Design do Card OpenPix

```text
┌─────────────────────────────────────────┐
│ 🟢 OpenPix                    [Ativa]  │
│                                         │
│ App ID:        [__________________]     │
│ Webhook Secret:[__________________]     │
│                                         │
│ URL do Webhook (copiar):                │
│ https://api..../webhook-transactions/   │
│ openpix?user_id=...                     │
│                                         │
│           [Salvar]  [Desconectar]       │
└─────────────────────────────────────────┘
```

