

## Integrações Dinâmicas — Criar integração com URL automática

### Problema Atual
O usuário precisa inserir manualmente a URL base da VPS. O sistema já tem `app_public_url` salvo no perfil (aba Aplicação), mas não está sendo usado corretamente.

### Solução
Refatorar a aba de Integrações para um modelo **dinâmico**: o usuário clica em "Nova Integração", seleciona a plataforma, preenche apenas as credenciais, e o webhook é gerado automaticamente usando o `app_public_url` do perfil.

### Como funciona

```text
1. Usuário vai em Configurações → Integrações
2. Clica em "+ Nova Integração"
3. Seleciona a plataforma (OpenPix, Mercado Pago, Yampi)
4. Preenche as credenciais específicas da plataforma
5. Salva → webhook URL gerado automaticamente
6. Pode copiar a URL e colar na plataforma externa
```

A URL do webhook será construída assim:
```
{profile.app_public_url}/api/webhook-transactions/{platform}?user_id={user.id}
```

Se `app_public_url` não estiver configurado, exibe um aviso com link para a aba "Aplicação".

### Mudanças

**`src/components/settings/IntegrationsSection.tsx`** — Reescrever completamente:
- Remover o card fixo `OpenPixCard` e o campo manual de URL base
- Criar lista de integrações existentes do usuário (vindas de `platform_connections`)
- Botão "+ Nova Integração" abre um dialog/formulário:
  - Select de plataforma com opções: OpenPix, Mercado Pago, Yampi
  - Campos dinâmicos por plataforma:
    - **OpenPix**: App ID, Webhook Secret (opcional)
    - **Mercado Pago**: Access Token
    - **Yampi**: API Token, Alias da Loja
  - Ao salvar, grava em `platform_connections`
- Cada integração salva mostra um card com:
  - Nome da plataforma + status (ativa/inativa)
  - URL do webhook (gerada automaticamente, copiável)
  - Botão editar / desconectar
  - Toggle ativar/desativar

**Nenhuma mudança em banco ou backend** — já suporta múltiplas plataformas e o formato `platform_connections` é genérico.

### Definição de campos por plataforma

| Plataforma | Campos | Ícone/Cor |
|---|---|---|
| OpenPix | App ID, Webhook Secret | Emerald |
| Mercado Pago | Access Token | Blue |
| Yampi | API Token, Alias da Loja | Purple |

### UX esperada

```text
┌─ Integrações ─────────────────────────────────┐
│                                                │
│  [+ Nova Integração]                           │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ 🟢 OpenPix                     [Ativa]  │  │
│  │ Webhook: https://api.meu.../openpix?...  │  │
│  │              [Copiar] [Editar] [Remover] │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ 🔵 Mercado Pago                [Ativa]  │  │
│  │ Webhook: https://api.meu.../mercado...   │  │
│  │              [Copiar] [Editar] [Remover] │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

