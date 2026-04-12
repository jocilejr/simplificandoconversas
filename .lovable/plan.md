

## Plano: Corrigir termos de gênero na saudação da IA

### Problema

O edge function `member-ai-context` tem **dois problemas**:

1. **Ignora o `greeting_prompt` configurado pelo usuário** — ele só lê `ai_persona_prompt` da tabela `member_area_settings`, mas nunca lê o campo `greeting_prompt` onde você configurou as regras de gênero neutro.

2. **Termos femininos hardcoded no código** — mesmo que o prompt do usuário diga "não use termos de gênero", o próprio código injeta termos femininos:
   - `"(MEMBRO NOVA!)"` (linha 88)
   - `"(ESTÁ SUMIDA!)"` (linha 90)  
   - `"NOVA"`, `"INATIVA"`, `"FIEL"` (linha 91)
   - `"MEMBRO NOVA: Boas-vindas calorosas"` (linha 103)
   - `"MEMBRO INATIVA: Mostre que sentiu falta"` (linha 104)

A IA recebe instruções conflitantes: o persona diz "não use gênero", mas o contexto do perfil diz "MEMBRO NOVA", "ESTÁ SUMIDA" — e a IA segue o contexto mais específico.

### Correções

**1. `supabase/functions/member-ai-context/index.ts`**

- Ler `greeting_prompt` da tabela `member_area_settings` (já está no select mas não é usado)
- **Se `greeting_prompt` existir**: usar ele como system prompt base (substituindo `{persona}` pelo `ai_persona_prompt`)
- **Se não existir**: usar o prompt hardcoded atual, mas com termos neutros
- Substituir todos os termos femininos hardcoded por neutros:

```text
"MEMBRO NOVA!"     → "MEMBRO NOVO(A)!"
"ESTÁ SUMIDA!"     → "ESTÁ SUMIDO(A)!"
"NOVA"             → "NOVO(A)"
"INATIVA"          → "INATIVO(A)"
"MEMBRO NOVA:"     → "MEMBRO NOVO(A):"
"MEMBRO INATIVA:"  → "MEMBRO INATIVO(A):"
```

- Adicionar regra explícita no prompt hardcoded:
```text
- NUNCA use termos que definam gênero como "bem-vindo/bem-vinda", "querido/querida". Use sempre termos neutros como "boas-vindas", cumprimente pelo nome diretamente.
```

**2. `supabase/functions/member-offer-pitch/index.ts`**

- Mesma correção: o prompt de offer-pitch também tem "Querido(a)" como fallback (linha no user prompt) e termos como "nova", "fiel" — neutralizar todos.

### Arquivos modificados
- `supabase/functions/member-ai-context/index.ts`
- `supabase/functions/member-offer-pitch/index.ts`

### Resultado esperado
- O prompt customizado do usuário (`greeting_prompt`) será respeitado quando configurado
- Termos hardcoded não conflitam mais com instruções de gênero neutro
- A IA não dirá "Querida Wanderley" — usará o nome diretamente sem prefixo de gênero

