

# Plano: Normalizar telefones na exibição do Follow Up

## Problema
Os telefones aparecem crus da tabela `transactions` (ex: `19989954680`, `47999338941`) sem o prefixo `55`.

## Solução
Importar `normalizePhone` de `@/lib/normalizePhone` no `FollowUpDashboard.tsx` e aplicar em todos os pontos de exibição de telefone.

### Arquivo: `src/components/followup/FollowUpDashboard.tsx`

1. Adicionar import: `import { normalizePhone } from "@/lib/normalizePhone";`
2. Linha 147 (tabela desktop): `boleto.customer_phone || "—"` → `normalizePhone(boleto.customer_phone)`
3. Linha 435 (dialog detalhe): `boleto.customer_phone || "Sem telefone"` → `normalizePhone(boleto.customer_phone)`
4. Linhas dos cards mobile que exibem telefone: aplicar `normalizePhone()` também

Os pontos funcionais (WhatsApp, busca) já fazem normalização internamente — sem impacto.

