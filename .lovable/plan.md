

# Importação inteligente de CSV com IA

## Resumo
Substituir a importação rígida de CSV (que exige colunas "email" e "nome") por um fluxo onde a IA analisa o conteúdo bruto do CSV, identifica automaticamente quais colunas contêm email, nome e tags, corrige erros, e apresenta um preview para o usuário aprovar antes de inserir.

## Fluxo do usuário
1. Usuário clica em "Importar CSV" e seleciona o arquivo
2. Um dialog de preview abre mostrando "Analisando com IA..." (loading)
3. A IA processa o CSV e retorna os contatos mapeados (email, nome, tags)
4. O dialog exibe uma tabela com os resultados: contatos válidos, corrigidos e ignorados
5. Usuário clica "Confirmar importação" para inserir no banco

## Arquivos a criar/modificar

### 1. Edge Function `supabase/functions/analyze-csv-contacts/index.ts`
- Recebe o CSV bruto como texto no body
- Envia para o Lovable AI Gateway (Gemini Flash) com um prompt que instrui a IA a:
  - Identificar qual coluna é email, nome, tags (independente do nome da coluna)
  - Corrigir domínios de email com erros de digitação
  - Classificar cada linha como `valid`, `corrected` ou `invalid` com motivo
  - Retornar JSON estruturado via tool calling
- Retorna a lista de contatos processados

### 2. `src/hooks/useEmailContacts.ts`
- Substituir `importCSV` por `analyzeCSV` que chama a edge function e retorna os dados analisados
- Adicionar `confirmImport` que faz o upsert dos contatos aprovados respeitando `onConflict: "user_id,email"`

### 3. `src/components/email/EmailContactsTab.tsx`
- Adicionar dialog de preview com tabela mostrando resultados da análise
- Estados: analyzing → preview → importing → done
- Badges indicando status de cada contato (válido/corrigido/ignorado)
- Botões "Confirmar importação" e "Cancelar"

## Detalhes técnicos

**Edge Function — prompt com tool calling:**
A IA recebe as primeiras 500 linhas do CSV e usa tool calling para retornar JSON estruturado com `{ contacts: [{ email, name, tags[], status, original_email?, reason? }] }`. Modelo: `google/gemini-3-flash-preview`.

**Limite de segurança:** CSVs com mais de 500 linhas serão truncados para a análise da IA (a IA analisa a estrutura nas primeiras linhas e o frontend aplica o mapeamento descoberto ao restante).

**Constraint unique:** O upsert usa `onConflict: "user_id,email"` — duplicatas são atualizadas (nome/tags), não geram erro.

