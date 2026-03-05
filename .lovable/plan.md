

## Bug: Link clicado retoma fluxo já encerrado e pela instância errada

### Causa raiz (2 problemas)

**Problema 1: Fluxo retoma mesmo já tendo sido encerrado pelo timeout**

No `link-redirect`, a unica verificacao e `if (!link.clicked)` (linha 92). Ele nao verifica se a execucao original ainda esta ativa. Se o timeout ja marcou a execucao como `completed`, o clique no link ainda assim chama `execute-flow` com `resumeFromNodeId`, criando uma **nova execucao** do zero a partir daquele no.

**Problema 2: Link nao armazena `instance_name`, entao o resume usa a instancia errada**

A tabela `tracked_links` nao tem coluna `instance_name`. Quando o `link-redirect` chama `execute-flow`, nao passa `instanceName`. O `execute-flow` faz fallback para `profile.evolution_instance_name` (Meire Rosana - Entregas), mesmo que o link tenha sido gerado pelo FunilPrincipal.

### Solucao

**1. Migration SQL** -- Adicionar coluna `instance_name` na tabela `tracked_links`:
```sql
ALTER TABLE public.tracked_links ADD COLUMN instance_name text;
```

**2. `supabase/functions/execute-flow/index.ts`** -- Salvar `instance_name` ao criar tracked_links:
- No insert de `tracked_links` (standalone e dentro de grupo), adicionar `instance_name: evolution_instance_name`

**3. `supabase/functions/link-redirect/index.ts`** -- 2 alteracoes:
- Passar `instanceName: link.instance_name` no body do fetch para `execute-flow`
- Antes de resumir o fluxo, verificar se a execucao original ainda esta em status `waiting_click`. Se ja foi `completed`/`cancelled`, nao chamar execute-flow (apenas redirecionar)

```text
Antes:
  click no link → link-redirect nao verifica status da execucao → resume sempre
  link-redirect nao passa instanceName → execute-flow usa instancia do perfil

Depois:
  click no link → link-redirect verifica se execucao esta waiting_click → so resume se ativa
  link-redirect passa instanceName do tracked_link → execute-flow usa instancia correta
```

### Arquivos alterados
- Migration SQL: adicionar coluna `instance_name` em `tracked_links`
- `supabase/functions/execute-flow/index.ts`: salvar `instance_name` nos inserts de tracked_links
- `supabase/functions/link-redirect/index.ts`: verificar status da execucao + passar instanceName

