

# Corrigir normalização de domínios curtos (gm.com → gmail.com, não r7.com)

## Problema

O algoritmo Damerau-Levenshtein puro favorece domínios canônicos curtos (como `r7.com`) sobre domínios mais longos (como `gmail.com`) quando o input também é curto. `gm.com` tem distância 2 de `r7.com` mas distância 3 de `gmail.com`, então o sistema escolhe errado.

Isso afeta qualquer abreviação acidental de domínios populares: `gm.com`, `gmai.com`, `hot.com`, `outl.com`, etc.

## Solução

Duas correções complementares no `src/lib/emailNormalizer.ts`:

### 1. Adicionar aliases conhecidos para abreviações comuns
Expandir o `KNOWN_ALIASES` com mapeamentos diretos para os casos mais frequentes:
- `gm.com` → `gmail.com`
- `gmai.com` → `gmail.com`
- `gmal.com` → `gmail.com`
- `gmil.com` → `gmail.com`
- `hotmal.com` → `hotmail.com`
- `hotmai.com` → `hotmail.com`
- `outloo.com` → `outlook.com`
- `outlok.com` → `outlook.com`
- `yaho.com` → `yahoo.com`

Aliases têm prioridade sobre a heurística — resolvem o problema sem tocar no algoritmo.

### 2. Adicionar bonus de prefixo na heurística
Quando o domínio de input é **prefixo** de um domínio canônico (ex: `gm` é prefixo de `gmail`), reduzir a distância efetiva em 2 pontos. Isso faz `gmail.com` ganhar de `r7.com` mesmo quando a distância pura diz o contrário.

Lógica na função `findBestMatch`:
```
// Se a parte antes do primeiro "." do input é prefixo da parte antes do "." do canônico
// → aplicar bonus (reduzir dist em 2)
```

### Arquivo alterado
- `src/lib/emailNormalizer.ts` — expandir `KNOWN_ALIASES` + adicionar lógica de prefixo em `findBestMatch`

Nenhuma mudança de banco, backend ou UI necessária.

