

# Adicionar `register_email` na documentação correta

## Problema
O evento `register_email` foi adicionado ao componente antigo (`EmailWebhooksTab.tsx`), mas a documentação que aparece na aba Configurações vem de `EmailSettingsSection.tsx`, que tem seu proprio array `EVENTS_DOC` sem o evento.

## Correção

### Arquivo: `src/components/settings/EmailSettingsSection.tsx`
- Linha 18: adicionar `register_email` ao array `EVENTS_DOC`:
  ```
  { event: "register_email", desc: "Cadastra e-mail na lista de contatos", fields: "email, name?, tags?" }
  ```
- Atualizar o exemplo de payload (linha 139-147) para mostrar o evento `register_email` com os campos `email`, `name` e `tags`

