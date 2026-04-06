

# Substituir importação por campo de texto simples

## O que muda

Remover toda a lógica de importação de CSV/TXT via IA e substituir por um campo de texto onde você cola e-mails separados por vírgula. O sistema usa o normalizador local (`emailNormalizer.ts`) para corrigir domínios, verifica duplicatas no banco, e insere os novos.

## Arquivos a alterar

### 1. `src/components/email/EmailContactsTab.tsx`
- Remover: botão "Importar arquivo", input de file, dialog de preview CSV, estados de analyzing/analyzedContacts
- Adicionar: botão "Importar e-mails" que abre um dialog com um `<Textarea>` onde o usuário cola e-mails separados por vírgula
- O dialog mostra preview dos e-mails processados (válidos, corrigidos, inválidos) usando o normalizador local
- Botão "Confirmar importação" insere os válidos/corrigidos

### 2. `src/hooks/useEmailContacts.ts`
- Remover: função `analyzeCSV` (que chama a edge function)
- Remover: interface `AnalyzedContact` (mover para o componente ou simplificar)
- Adicionar: função `bulkImportEmails(emailsText: string)` que:
  1. Faz split por vírgula, ponto-e-vírgula, ou nova linha
  2. Aplica `normalizeEmail()` em cada um
  3. Verifica quais já existem no banco (query simples)
  4. Retorna lista classificada: válido, corrigido, inválido, duplicado
- Adicionar: função `confirmBulkImport(emails)` que faz upsert dos válidos/corrigidos

### 3. Arquivos que NÃO serão alterados
- `src/lib/emailNormalizer.ts` — já funciona bem, será reutilizado
- `deploy/backend/src/routes/analyze-csv-contacts.ts` — pode ficar como está (não será mais chamado pelo frontend)
- `supabase/functions/analyze-csv-contacts/index.ts` — idem

## Fluxo do usuário

1. Clica "Importar e-mails"
2. Cola lista de e-mails no textarea (separados por vírgula, ponto-e-vírgula ou linha)
3. Clica "Processar"
4. Vê preview: ✅ válidos, ✏️ corrigidos, ❌ inválidos, ⚠️ já existentes
5. Clica "Confirmar importação (N)"
6. Contatos inseridos

## Detalhes técnicos

- O processamento é 100% local no frontend usando `normalizeEmail()`
- Verificação de duplicatas: query `SELECT email FROM email_contacts WHERE user_id = ? AND email IN (...)`
- Inserção via `supabase.from("email_contacts").upsert(rows, { onConflict: "user_id,email" })`
- Sem dependência de IA, edge function, ou backend da VPS para esta funcionalidade

