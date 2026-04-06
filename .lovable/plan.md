

# Fix: Importação de CSV na VPS

## Problema
A importação de CSV usa `supabase.functions.invoke("analyze-csv-contacts")`, que na VPS é mapeado para `/api/analyze-csv-contacts` no backend Express. Porém essa rota **não existe** no backend — só existe como Edge Function no Lovable Cloud, que você não usa.

## Solução
Criar a rota `POST /api/analyze-csv-contacts` no backend Express da VPS com a mesma lógica de análise de CSV. A rota terá dois modos:

1. **Com IA** (se `OPENAI_API_KEY` estiver configurado no `.env`): usa a API da OpenAI para analisar o CSV inteligentemente (mesmo comportamento da Edge Function)
2. **Sem IA** (fallback determinístico): parser heurístico que detecta automaticamente colunas de email, nome e tags por padrão de conteúdo — sem depender de nenhuma API externa

## Arquivo a criar

### `deploy/backend/src/routes/analyze-csv-contacts.ts`
- Recebe `{ csv_text }` no body
- Faz parse do CSV linha a linha
- Detecta qual coluna contém emails (busca por `@`), nomes e tags
- Aplica a normalização de email já existente no backend (Damerau-Levenshtein)
- Classifica cada contato como `valid`, `corrected` ou `invalid`
- Se `OPENAI_API_KEY` estiver disponível, usa a OpenAI para análise inteligente (como a Edge Function faz)
- Retorna `{ contacts: [...], total_csv_lines }` no mesmo formato da Edge Function

## Arquivo a modificar

### `deploy/backend/src/index.ts`
- Importar e registrar a nova rota: `app.use("/api/analyze-csv-contacts", analyzeCsvRouter)`

## Detalhes técnicos
- O parser heurístico funciona assim:
  - Lê o header e cada coluna do CSV
  - Coluna com mais valores contendo `@` = email
  - Coluna com nomes mais prováveis (sem `@`, sem números) = nome
  - Outras colunas = tags
- A normalização de domínio reutiliza o mesmo engine já presente em `email.ts`
- O formato de resposta é idêntico ao da Edge Function, então o frontend não precisa de alteração
- Autenticação via JWT (mesmo padrão das outras rotas do backend)

