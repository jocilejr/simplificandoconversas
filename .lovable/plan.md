

# Adicionar evento `register_email` na documentação do webhook

## Problema
O evento `register_email` foi implementado no backend mas não foi adicionado à tabela de documentação no componente `EmailWebhooksTab.tsx`.

## Correção
Adicionar uma entrada no array `EVENTS_DOC` e atualizar o exemplo de payload.

### Arquivo: `src/components/email/EmailWebhooksTab.tsx`
- Adicionar ao array `EVENTS_DOC`:
  ```
  { event: "register_email", desc: "Cadastra e-mail na lista de contatos", fields: "email, name?, tags?" }
  ```
- Atualizar o exemplo de payload para mostrar o novo evento `register_email`

