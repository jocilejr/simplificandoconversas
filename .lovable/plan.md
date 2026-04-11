

## Plano: Melhorar sombreamento do LockedOfferCard

### Alteração em `src/components/membros/LockedOfferCard.tsx`

**Linha 84** — trocar as classes de shadow do container:

De:
```
shadow-md shadow-gray-200/60
```

Para:
```
shadow-[0_2px_12px_-2px_rgba(0,0,0,0.12),0_4px_20px_-4px_rgba(0,0,0,0.08)]
```

Isso aplica uma sombra em duas camadas (uma mais próxima e concentrada, outra mais difusa e profunda), criando o efeito de elevação profissional semelhante aos cards do Material Design.

Também adicionar `hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.18),0_8px_30px_-6px_rgba(0,0,0,0.12)]` para dar feedback visual no hover.

O botão "Desbloquear" (linhas 99 e 118) já tem `shadow-sm hover:shadow-md`, que é adequado.

