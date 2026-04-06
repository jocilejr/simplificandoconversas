

# Adicionar botão "Corrigir e-mails" na aba de Contatos de E-mail

## O que será feito
Adicionar um botão "Corrigir e-mails" ao lado dos botões existentes (Importar CSV, Adicionar). Ao clicar, o sistema varre todos os contatos existentes, aplica o `normalizeEmail()` em cada um, e atualiza **apenas** os que têm domínio incorreto. E-mails já corretos não são tocados.

## Arquivos modificados

### 1. `src/hooks/useEmailContacts.ts`
Adicionar função `fixEmails()`:
- Percorre `allContacts` e aplica `normalizeEmail()` em cada e-mail
- Filtra apenas os que retornaram `corrected: true`
- Se não houver nenhum para corrigir, exibe toast informativo e retorna
- Para cada corrigido: faz `update` do registro pelo `id`, alterando o campo `email` para o valor normalizado
- Se o e-mail corrigido já existir (duplicata), deleta o registro antigo em vez de atualizar (evita conflito de unique constraint)
- Ao final, exibe toast com quantidade de correções e faz `refetch`
- Retorna o estado `fixing` (boolean) para o botão mostrar loading

### 2. `src/components/email/EmailContactsTab.tsx`
- Importar `Wand2` do lucide-react (ícone de varinha)
- Desestruturar `fixEmails` e `allContacts` do hook
- Adicionar estado `fixing`
- Adicionar botão "Corrigir e-mails" entre "Importar CSV" e "Adicionar":
  ```
  <Button variant="outline" size="sm" onClick={fixEmails} disabled={fixing}>
    <Wand2 /> Corrigir e-mails
  </Button>
  ```

## Lógica de segurança
- Apenas modifica a parte após o `@` (garantido pelo `normalizeEmail`)
- E-mails que o normalizador não reconhece como errados ficam intactos
- Duplicatas resultantes (mesmo e-mail pós-correção) são mescladas: o registro com domínio errado é removido

