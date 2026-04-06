

# Corrigir TLDs com erros de digitação (`.comn`, `.cpm`, `.vom`, etc.)

## Problema
O e-mail `aparecidamachado149@gmail.comn` não foi corrigido porque `.comn` não estava no dicionário. Adicionar cada variação manualmente não escala — o erro pode ser `.comn`, `.coma`, `.coml`, `.cpm`, `.vom`, `.xom`, etc. em qualquer domínio.

## Solução
Adicionar ao `normalizeEmail()` uma **camada genérica de correção de TLD** que roda **após** o dicionário de typos, corrigindo erros comuns no final do domínio independente do provedor:

### Regras de correção de TLD (após o `@`, no final do domínio)
1. `.comn`, `.comm`, `.comr`, `.coms`, `.coml`, `.coma`, `.come` → `.com`
2. `.cpm`, `.vom`, `.xom`, `.dom`, `.fom`, `.c0m` → `.com`
3. `.con` → `.com` (já existe parcialmente, será genérico)
4. `.com.brr`, `.com.bra`, `.com.brn` → `.com.br`
5. `.nt` → `.net`
6. `.ogr` → `.org`

### Arquivo modificado
`src/lib/emailNormalizer.ts` — adicionar após a checagem do dicionário de typos e antes de montar o e-mail final:

```
// Padrões de TLD incorreto → TLD correto
const TLD_FIXES: [RegExp, string][] = [
  [/\.com[a-z]$/, ".com"],       // .comn, .coml, .coma, etc.
  [/\.comm+$/, ".com"],          // .comm, .commm
  [/\.[cvxdf]om$/, ".com"],      // .vom, .cpm, .xom, .dom, .fom
  [/\.c0m$/, ".com"],            // .c0m
  [/\.com\.br[a-z]$/, ".com.br"],// .com.brr, .com.brn
  [/\.nte$/, ".net"],
  [/\.ogr$/, ".org"],
];
```

Isso corrige **qualquer** domínio que termine com esses padrões, não apenas gmail.

### Duplicatas
O e-mail da screenshot aparece duas vezes — ambos com `.comn`. Após a correção do TLD, o botão "Corrigir e-mails" vai normalizar ambos para `@gmail.com` e o sistema de deduplicação (já implementado no `fixEmails`) vai mesclar automaticamente, removendo o registro duplicado.

### Backend
A mesma lógica precisa ser replicada em `deploy/backend/src/routes/email.ts` para que o webhook também corrija TLDs antes do upsert.

