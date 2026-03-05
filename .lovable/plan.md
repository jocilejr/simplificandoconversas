

## Diagnóstico: A tag ESTÁ sendo adicionada corretamente

Verifiquei o banco de dados e a tag **já existe** para este contato:

```text
contact_tags:
  remote_jid: 558981340810@s.whatsapp.net
  tag_name: passou-pelo-funil-principal
  created_at: 2026-03-05 13:48:13
```

Os logs do executor confirmam: `Condition has_tag "Passou-pelo-funil-principal": true`. Isso significa que a tag foi adicionada com sucesso em uma execução anterior. Como a condição retornou **verdadeira**, o fluxo seguiu pelo caminho "Sim ✓" (que não tem nó conectado) e encerrou — por isso a ação no caminho "Não ✗" não executou desta vez.

### O problema real: não há UI para visualizar tags do contato

A seção "ETIQUETAS" no painel lateral mostra **labels de conversa** (tabela `conversation_labels`), que são um sistema diferente das **tags de contato** (tabela `contact_tags`) usadas pelo fluxo. Por isso parece que nada aconteceu.

### Correção proposta

Adicionar uma seção **"TAGS"** no `RightPanel.tsx` que:
1. Busque as tags do contato na tabela `contact_tags` pelo `remote_jid`
2. Exiba as tags como badges coloridos (estilo pill/roxo, similar ao visual do builder)
3. Permita ao usuário ver quais tags o fluxo atribuiu ao contato

Alteração em 1 arquivo: `src/components/conversations/RightPanel.tsx` (+ um hook `useContactTags` ou query inline).

