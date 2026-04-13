

## Problema

A máscara `maskPhone` no `GerarBoleto.tsx` usa `slice(0, 11)` para limitar os dígitos. Se o número do usuário tem mais de 11 dígitos (ex: ele digita o número completo com um dígito extra), o último é cortado antes mesmo de enviar.

## Solução

Alterar o limite do `slice` e ajustar a regex da máscara para aceitar números de até **11 dígitos** corretamente, garantindo que nenhum dígito seja descartado.

### Arquivo: `src/pages/GerarBoleto.tsx`

Substituir a função `maskPhone` (linhas 14-18):

```typescript
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return d.replace(/(\d{2})(\d)/, "($1) $2");
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};
```

A lógica continua limitando a 11 dígitos (padrão brasileiro), mas as regexes agora capturam todos os grupos corretamente sem perder o último dígito.

**Se o número real do usuário tinha mais de 11 dígitos** (ex: ele já incluiu o "55" do código do país no campo), a solução seria aumentar o `slice` para 13:

```typescript
const d = v.replace(/\D/g, "").slice(0, 13);
```

E ajustar a máscara para lidar com 13 dígitos (55 + DDD + número). Me avise se esse é o caso.

