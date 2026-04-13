

## Problema

A máscara atual faz `slice(0, 11)` — trunca qualquer número maior que 11 dígitos. Quando o usuário cola `+55 89 98134-0810` (13 dígitos), perde os últimos 2. Além disso, força formato fixo que não funciona para todos os casos.

## Solução

Remover o limite de caracteres e fazer a máscara aceitar qualquer tamanho de número, formatando visualmente sem restringir a entrada.

### Arquivo: `src/pages/GerarBoleto.tsx`

Substituir a função `maskPhone` (linhas 14-20) por uma versão sem `slice`:

```typescript
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length <= 2) return d;
  // Com código de país (55...) — formato: +55 (DD) XXXXX-XXXX
  if (d.length >= 12 && d.startsWith("55")) {
    const cc = d.slice(0, 2);
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    if (rest.length <= 4) return `+${cc} (${ddd}) ${rest}`;
    if (rest.length <= 8) return `+${cc} (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `+${cc} (${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
  }
  // Sem código de país — formato: (DD) XXXXX-XXXX
  if (d.length <= 6) return d.replace(/(\d{2})(\d)/, "($1) $2");
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};
```

Isso permite colar qualquer formato (`+55 89 98134-0810`, `5589981340810`, `89981340810`) e formata bonito sem cortar dígitos.

