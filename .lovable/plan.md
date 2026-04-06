
Objetivo

Trocar o corretor atual por um motor de normalização por confiança, em vez de continuar aumentando listas de typos. Assim ele passa a corrigir variações novas sem “inventar moda” e sem tocar em e-mails já completos/corretos.

O que está falhando hoje

Os casos do print mostram limites do modelo atual:
- `@hotmail.com8`: domínio certo + lixo no fim
- `@gmil.comeh`: erro no provedor + erro no TLD ao mesmo tempo
- `@736gmail.com.br`: lixo antes do domínio
- o fluxo atual depende demais de dicionário + regex isoladas

Nova solução

1. Substituir `normalizeEmail()` por um analisador com 4 estados
- `exact`: e-mail já está correto, não mexe
- `corrected`: corrigido com alta confiança
- `ambiguous`: parece erro, mas sem confiança suficiente; não salva/corrige automaticamente
- `invalid`: continua inválido

2. Corrigir só a parte após `@`
- A parte antes do `@` continua intocável em 100% dos casos
- Se não existir `@`, o motor tenta inferir a divisão usando apenas domínios conhecidos/aliases
- Se não houver confiança, não corrige

3. Trocar “lista infinita” por heurísticas combinadas
No domínio apenas:
- normalizar caixa/espacos/caracteres óbvios de ruído
- detectar domínio conhecido mesmo com lixo antes/depois:
  - `736gmail.com.br` -> alias de `gmail.com`
  - `hotmail.com8` -> `hotmail.com`
- separar “nome do provedor” e “TLD”
- usar similaridade entre o provedor digitado e provedores canônicos (`gmail`, `hotmail`, `outlook`, `yahoo`, `icloud`, `live`, `uol`, `bol`, `terra`, `ig`, `globo`, `globomail`, `protonmail`)
- corrigir TLD por regras genéricas e também por score:
  - `.comn`, `.comeh`, `.c0m`, `.con`, `.cm`, `.com8`, `.com.br7`
- só aceitar correção quando houver alta confiança e boa diferença para a 2ª melhor hipótese

4. Preservar e-mails completos
Regra crítica:
- Se o domínio já for sintaticamente válido e não parecer claramente um erro, não alterar
- Isso evita mexer em domínios corporativos reais
- O corretor só autoajusta quando o domínio estiver quebrado ou quando a intenção for muito clara

Arquivos a ajustar

1. `src/lib/emailNormalizer.ts`
- substituir a função atual por algo como `analyzeEmail()` / `normalizeEmail()`
- retornar também:
  - `status`
  - `reason`
  - `confidence`
- incluir:
  - lista de domínios canônicos
  - aliases válidos
  - função de similaridade simples em TS (ex.: Damerau-Levenshtein/Jaro-Winkler implementada no próprio arquivo)
  - limpeza de ruído antes/depois do domínio

2. `src/hooks/useEmailContacts.ts`
- `addContact()`:
  - `exact` -> salva sem mexer
  - `corrected` -> salva corrigido + toast
  - `ambiguous`/`invalid` -> bloquear e mostrar erro
- `importCSV()`:
  - importar válidos/corrigidos
  - pular ambíguos/inválidos
  - mostrar resumo: quantos corrigidos, quantos ignorados
- `fixEmails()`:
  - corrigir apenas registros `corrected`
  - não tocar em `exact`
  - não tocar em `ambiguous`
  - continuar fazendo merge de duplicados após normalização

3. `deploy/backend/src/routes/email.ts`
- aplicar exatamente a mesma lógica no `register_email`
- se o resultado for `ambiguous`/`invalid`, responder erro claro em vez de gravar lixo
- manter o `upsert` por `user_id,email` para a deduplicação continuar funcionando

4. `src/test/`
- adicionar testes unitários para o normalizador com casos reais
- exemplos mínimos:
  - `teste@gmail.com` -> exact
  - `teste@gmail.comn` -> corrected -> `gmail.com`
  - `teste@hotmail.com8` -> corrected -> `hotmail.com`
  - `teste@gmil.comeh` -> corrected -> `gmail.com`
  - `teste@736gmail.com.br` -> corrected -> `gmail.com`
  - `empresa@minhadomain.com.br` -> exact
  - casos ambíguos devem ficar como `ambiguous`, não corrigidos

Decisões de segurança

- Não precisa mudar banco
- Não precisa IA generativa para decidir domínio
- Não corrigir por “achismo”
- Se a confiança for baixa, deixar para revisão manual
- Nunca alterar a parte antes do `@`

Resultado esperado

Depois disso, o sistema deixa de depender de “citar erro por erro” e passa a corrigir classes inteiras de erro:
- lixo antes do domínio
- lixo depois do TLD
- TLD quebrado
- provedor com 1-3 erros de digitação
- ausência de `@` quando a intenção for clara

Verificação na sua VPS

Depois da implementação, eu vou te pedir para validar dentro da VPS com estes testes:

```bash
cd /root/simplificandoconversas/deploy

docker compose exec -T backend wget -qO- \
  --header="Content-Type: application/json" \
  --header="X-API-Key: SUA_CHAVE" \
  --post-data='{"event":"register_email","data":{"email":"teste@hotmail.com8","name":"Teste"}}' \
  http://localhost:3001/api/email/webhook/inbound

docker compose exec -T backend wget -qO- \
  --header="Content-Type: application/json" \
  --header="X-API-Key: SUA_CHAVE" \
  --post-data='{"event":"register_email","data":{"email":"teste@gmil.comeh","name":"Teste"}}' \
  http://localhost:3001/api/email/webhook/inbound

docker compose exec -T backend wget -qO- \
  --header="Content-Type: application/json" \
  --header="X-API-Key: SUA_CHAVE" \
  --post-data='{"event":"register_email","data":{"email":"teste@736gmail.com.br","name":"Teste"}}' \
  http://localhost:3001/api/email/webhook/inbound

docker compose exec -T postgres psql -U postgres -d postgres -c "
select email, created_at
from public.email_contacts
where email ilike '%hotmail.com8%'
   or email ilike '%gmil.comeh%'
   or email ilike '%736gmail.com.br%'
order by created_at desc;
"
```

Resumo do plano

- parar de expandir dicionário manual
- criar motor por similaridade + confiança
- corrigir só quando o domínio estiver claramente quebrado
- preservar e-mails válidos/completos
- aplicar a mesma regra no botão, cadastro, CSV e webhook da VPS
