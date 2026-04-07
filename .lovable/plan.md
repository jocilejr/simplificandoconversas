

# Fix: Normalizar telefone antes de salvar no banco de dados

## Problema

Os números de telefone estão sendo salvos na tabela `transactions` com formatos inconsistentes (ex: `051997147570`, `011999716771`) — com zero inicial que deveria ser removido e sem o prefixo `55`.

A função `normalizePhone` já existe em `recovery-dispatch.ts` e faz exatamente o que é necessário:
1. Remove caracteres não numéricos
2. Remove zeros iniciais (`replace(/^0+/, "")`)
3. Adiciona prefixo `55` se necessário

Porém essa função só é usada na hora do envio da recuperação — **não é usada na hora de persistir** o telefone no banco.

## Solução

### 1. Extrair `normalizePhone` para um utilitário compartilhado

Criar `deploy/backend/src/lib/normalize-phone.ts` com a função que já existe em `recovery-dispatch.ts`:

```typescript
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let phone = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (phone.length >= 10 && phone.length <= 11 && !phone.startsWith("55")) {
    phone = "55" + phone;
  }
  return phone || null;
}
```

### 2. Aplicar em todos os webhooks (4 arquivos)

| Arquivo | Onde aplicar |
|---------|-------------|
| `payment.ts` | Geração de boleto/PIX (linha ~260), webhook Step 4 (linhas ~709, ~769) |
| `yampi-webhook.ts` | Função `extractCustomer` (linha ~31) |
| `manual-payment-webhook.ts` | Variável `cleanPhone` (linha ~80) |
| `payment-openpix.ts` | Geração (linha ~116) e webhook (linhas ~240, ~268, ~310, ~337, ~377) |

### 3. Atualizar `recovery-dispatch.ts`

Importar de `normalize-phone.ts` em vez de ter a função duplicada.

### Resultado

| Entrada | Antes (banco) | Depois (banco) |
|---------|--------------|----------------|
| `051997147570` | `051997147570` | `5551997147570` |
| `011999716771` | `011999716771` | `5511999716771` |
| `5511999999999` | `5511999999999` | `5511999999999` (sem mudança) |
| `(51) 99714-7570` | `51997147570` | `5551997147570` |

### Deploy

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

