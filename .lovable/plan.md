

# Fix: Erro de sintaxe em `payment.ts`

## Problema
O objeto `paymentBody` (linha 81) não está sendo fechado antes do bloco `if (type === "boleto")`. O `if` na linha 94 está dentro do objeto literal, causando erro de compilação TypeScript.

## Correção em `deploy/backend/src/routes/payment.ts`

Linha 92 atual:
```ts
      },
    // Inject random address for boleto
```

Corrigir para:
```ts
      },
    };

    // Inject random address for boleto
```

Basta adicionar `};` após o fechamento do `payer` (linha 92) para fechar o objeto `paymentBody` antes do bloco `if`.

## Após aplicar
```bash
cd ~/simplificandoconversas/deploy
docker compose build backend && docker compose up -d backend
```

