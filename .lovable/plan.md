

## Plano: Separar "Ajustes Entrega" em nova seção da sidebar de Configurações

### O que muda

**1. Nova seção na sidebar: "Ajustes Entrega"** (`src/pages/SettingsPage.tsx`)
- Adicionar entrada `{ key: "delivery", label: "Ajustes Entrega", icon: Package, minRole: "admin" }` na lista `allSections`
- Renderizar um novo componente `DeliverySettingsSection` quando `active === "delivery"`

**2. Novo componente `DeliverySettingsSection`** (`src/components/settings/DeliverySettingsSection.tsx`)
- Conterá apenas o campo "Mensagem padrão de entrega" (movido do `DominioTab`)
- Adicionar um botão/chip de variável `{link}` que insere `{link}` na posição do cursor no Textarea
- Dica explicativa: "Use `{link}` para posicionar o link de acesso na mensagem. Se não incluído, o link será adicionado na última linha."
- Botão "Salvar" que persiste em `delivery_settings.delivery_message`

**3. Remover a mensagem de entrega do `DominioTab`** (`src/components/settings/MemberAreaSettingsSection.tsx`)
- Remover o Card da mensagem de entrega e o state `deliveryMessage` do `DominioTab`
- O `DominioTab` ficará apenas com: lista de domínios + seleção de domínio ativo + instruções DNS

**4. Atualizar componentes que usam `delivery_message`** (se necessário)
- Verificar `DeliveryFlowDialog` e `LinkGenerator` para garantir que respeitem a posição de `{link}` na mensagem em vez de sempre adicionar no final

