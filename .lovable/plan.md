

## Análise

Existem dois campos de mensagem redundantes:
- **"Template da Mensagem de Link"** (`link_message_template`) — não é usado em nenhum lugar do fluxo de entrega real
- **"Mensagem padrão de entrega"** (`delivery_message`) — este é o campo efetivamente utilizado no `DeliveryFlowDialog` e `LinkGenerator` para montar a mensagem final

O campo **"URL de Redirecionamento Global"** (`global_redirect_url`) também não é referenciado no fluxo de entrega.

## Plano

### Arquivo: `src/components/settings/MemberAreaSettingsSection.tsx` (DominioTab)
- Remover o state e campo de `globalRedirectUrl`
- Remover o state e campo de `linkMessageTemplate`
- Manter apenas `customDomain` e `deliveryMessage`
- Remover esses campos do payload de save (`saveMut`)

### Arquivo: `src/components/entrega/DomainSettings.tsx`
- Remover os campos `global_redirect_url` e `link_message_template` do formulário (este componente pode estar duplicado/legado, mas será limpo igualmente)

Resultado: a aba Domínio ficará apenas com DNS + Domínio Personalizado + Mensagem de entrega.

