

# Normalização inteligente de e-mails e prevenção de duplicatas

## Problema
Usuários digitam e-mails com erros após o `@` (ex: `@gemil.com`, `@gmial.com`, `@hotmal.com`) ou até sem `@`. Hoje esses e-mails inválidos são registrados como estão, gerando contatos com endereços inutilizáveis e possíveis duplicatas (o mesmo usuário com `@gmail.com` e `@gmial.com`).

## Solução
Criar uma função utilitária `normalizeEmail()` que corrige erros comuns no domínio (após o `@`) usando um dicionário de correções conhecidas, sem IA externa. Isso é mais rápido, determinístico e não depende de API. A função será aplicada em **todos os pontos de entrada** de e-mail.

### Lógica de normalização (sem IA externa — dicionário determinístico)
Usar IA para corrigir domínios de e-mail seria arriscado (poderia "inventar moda"). Um dicionário de typos conhecidos é mais seguro e previsível:

1. **Sem `@`**: tentar detectar padrões como `joaogmail.com` → `joao@gmail.com` (procurar domínios conhecidos no final da string)
2. **Domínio com typo**: mapear ~50 variações comuns:
   - `gemil.com`, `gmial.com`, `gmai.com`, `gnail.com` → `gmail.com`
   - `hotmal.com`, `hotmial.com`, `hotmai.com` → `hotmail.com`
   - `outlok.com`, `outllook.com` → `outlook.com`
   - `yaho.com`, `yahooo.com` → `yahoo.com`
   - etc.
3. **Domínio incompleto**: `gmail` sem `.com` → `gmail.com`
4. **Nunca alterar a parte antes do `@`**

### Pontos de aplicação (3 locais)

1. **Frontend — `useEmailContacts.ts`**
   - `addContact()`: normalizar antes do upsert
   - `importCSV()`: normalizar cada linha antes do upsert em lote

2. **Backend — `deploy/backend/src/routes/email.ts`**
   - `register_email`: normalizar antes do upsert

### Prevenção de duplicatas
O `upsert` com `onConflict: "user_id,email"` já previne duplicatas quando o e-mail é idêntico. Com a normalização, `joao@gemil.com` será corrigido para `joao@gmail.com` antes do upsert, evitando a duplicata.

### Feedback ao usuário
Quando o e-mail for corrigido, mostrar um toast informativo:
- `"E-mail corrigido: joao@gemil.com → joao@gmail.com"`

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/emailNormalizer.ts` | **Novo** — função `normalizeEmail()` com dicionário de correções |
| `src/hooks/useEmailContacts.ts` | Importar e aplicar `normalizeEmail()` em `addContact` e `importCSV` |
| `deploy/backend/src/routes/email.ts` | Copiar a mesma lógica e aplicar no `register_email` |

### Detalhes técnicos

A função `normalizeEmail(input: string)` retorna `{ email: string; corrected: boolean; original: string }`.

Dicionário parcial de correções:
```text
gemil.com      → gmail.com
gmial.com      → gmail.com
gmai.com       → gmail.com
gnail.com      → gmail.com
gamil.com      → gmail.com
gmail.com.br   → gmail.com
hotmal.com     → hotmail.com
hotmial.com    → hotmail.com
hotmai.com     → hotmail.com
hotmaill.com   → hotmail.com
outlok.com     → outlook.com
outllook.com   → outlook.com
outloock.com   → outlook.com
yaho.com       → yahoo.com
yahooo.com     → yahoo.com
yahoo.com.br   → yahoo.com.br  (mantém, é válido)
```

Para e-mails sem `@`: procurar se a string termina com algum domínio conhecido (ex: `joaogmail.com` → `joao@gmail.com`). Se não encontrar padrão reconhecível, rejeitar com erro.

