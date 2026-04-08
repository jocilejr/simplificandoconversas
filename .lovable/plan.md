

# Aba de Relatório Financeiro na página de Transações

## Resumo
Adicionar uma aba "Relatório" na página de Transações com um dashboard financeiro idêntico ao do projeto Finance Hub. A aba terá: stat cards por tipo de pagamento (gerado vs pago), cards de faturamento/imposto/líquido, gráfico de faturamento (area chart) e gráfico de distribuição por método (pie chart).

## Estrutura

A página `Transacoes.tsx` passará a ter duas abas de nível superior: **Transações** (conteúdo atual) e **Relatório** (novo dashboard financeiro).

## Arquivos a criar

### 1. `src/components/transactions/FinancialReport.tsx`
Componente principal da aba Relatório, contendo:
- **DateFilter** — filtro de período (Hoje, Ontem, 7 dias, 30 dias, Personalizado) idêntico ao Finance Hub
- **Stat Cards (linha 1)** — PIX Gerado, Boleto Gerado, Cartão Gerado (variant info)
- **Stat Cards (linha 2)** — PIX Pago, Boleto Pago, Cartão Pago (variant success) com taxa de conversão
- **Stat Cards (linha 3)** — Faturamento, Líquido (sem imposto/ads por enquanto, simplificado)
- **RevenueChart** — gráfico de área com faturamento por dia, separado por tipo (boleto/pix/cartão), com seletor de período (3D, 7D, 15D, 1M, 6M)
- **PaymentMethodsChart** — gráfico de pizza com distribuição por método de pagamento

Usará os dados de `useTransactions` filtrados pelo período selecionado e fará queries adicionais para o RevenueChart (que precisa de dados de vários dias).

Mapeamento de status do projeto atual:
- `aprovado` = pago
- `pendente` = gerado
- `rejeitado` = rejeitado

### 2. `src/components/transactions/RevenueChart.tsx`
Gráfico de área (recharts) copiado/adaptado do Finance Hub, com cores para boleto/pix/cartão e seletor de período interno.

### 3. `src/components/transactions/PaymentMethodsChart.tsx`
Gráfico de pizza (recharts) copiado/adaptado do Finance Hub mostrando distribuição por tipo.

### 4. `src/components/transactions/DateFilter.tsx`
Componente de filtro de datas com presets (Hoje, Ontem, 7 dias, 30 dias) + calendário personalizado.

### 5. `src/components/transactions/FinancialStatCard.tsx`
StatCard com variantes (success, info, warning) e animação, idêntico ao do Finance Hub.

## Arquivo a modificar

### `src/pages/Transacoes.tsx`
Adicionar Tabs de nível superior com duas abas:
- **Transações** — conteúdo atual (`TransactionsTable`)
- **Relatório** — novo componente `FinancialReport`

## Dados
- O RevenueChart buscará transações dos últimos 6 meses (independente do filtro de data da tabela) para ter dados completos no gráfico
- As stat cards usam as transações filtradas pelo DateFilter
- Não incluirá GroupStats, MetaAds ou financial_settings (tabelas que não existem neste projeto)

## Dependências
- `recharts` — já instalado no projeto
- `date-fns` — já disponível
- Nenhuma migração de banco necessária

