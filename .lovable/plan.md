

# Plano: Ajustes no Follow Up

## Resumo
3 correções cirúrgicas, sem complexidade extra.

## 1. Fallback de vencimento no frontend: 3 → 7
**Arquivo:** `src/hooks/useBoletoRecovery.ts` (linha 167)
- Trocar `|| 3` por `|| 7` para alinhar com o backend e o default da tabela `boleto_settings`

## 2. Coluna "Status" → "Regra"
**Arquivo:** `src/components/followup/FollowUpDashboard.tsx`
- Header (linha 136): renomear "Status" para "Regra"
- Corpo (linhas 154-163): substituir os badges condicionais (Enviado/Vencido/Pendente) por apenas o nome da regra aplicável:
  - Se tem regra: mostrar `boleto.applicableRule.name`
  - Se não tem regra: mostrar "—"
- A coluna "Envio" (linhas 165-178) continua intacta — ela já cobre o status de envio

## 3. Deduplicação por CPF — já está implementada
O backend (`followup-daily.ts` linhas 424-497) já deduplica por CPF. **Nenhuma alteração necessária** nessa lógica. O primeiro boleto por CPF vai para a fila, os demais são marcados como `skipped_duplicate`.

## Arquivos modificados
- `src/hooks/useBoletoRecovery.ts` — 1 linha (fallback)
- `src/components/followup/FollowUpDashboard.tsx` — header + corpo da coluna Status→Regra

