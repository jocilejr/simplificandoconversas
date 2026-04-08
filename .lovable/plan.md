# Aba "Taxas" nas Configurações

## Resumo

Criar uma nova aba "Taxas" na página de Configurações para o usuário definir taxas por método de pagamento (boleto, PIX, cartão) e impostos. Cada taxa pode ser **fixa** (R$) ou **percentual** (%). O relatório financeiro usará esses valores para calcular o "Líquido".  
  
Essa taxa vai ser implementada dentro do WORKSPACE, não podendo transbordar para os outros workspaces

## Migração SQL

Criar tabela `financial_settings`:

```sql
CREATE TABLE public.financial_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  
  -- Taxas por método
  boleto_fee_type text NOT NULL DEFAULT 'fixed',    -- 'fixed' ou 'percent'
  boleto_fee_value numeric NOT NULL DEFAULT 0,
  pix_fee_type text NOT NULL DEFAULT 'fixed',
  pix_fee_value numeric NOT NULL DEFAULT 0,
  cartao_fee_type text NOT NULL DEFAULT 'percent',
  cartao_fee_value numeric NOT NULL DEFAULT 0,
  
  -- Impostos
  tax_type text NOT NULL DEFAULT 'percent',          -- 'fixed' ou 'percent'
  tax_value numeric NOT NULL DEFAULT 0,
  tax_name text NOT NULL DEFAULT 'Imposto',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(workspace_id)
);

ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;

-- RLS padrão do workspace
CREATE POLICY "ws_select" ON public.financial_settings FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.financial_settings FOR INSERT TO authenticated
  WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.financial_settings FOR UPDATE TO authenticated
  USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.financial_settings FOR DELETE TO authenticated
  USING (has_workspace_role(auth.uid(), workspace_id, 'admin'));
```

## Arquivos a criar

### 1. `src/hooks/useFinancialSettings.ts`

Hook para buscar e salvar as configurações de taxas. Faz upsert na tabela `financial_settings` pelo `workspace_id`.

### 2. `src/components/settings/FeesSection.tsx`

Componente da aba "Taxas" com:

- **3 blocos** (Boleto, PIX, Cartão): cada um com toggle "Fixa / Percentual" e input do valor
- **1 bloco** de Impostos: toggle "Fixo / Percentual", input do valor, campo nome do imposto
- Botão "Salvar"

## Arquivos a modificar

### `src/pages/SettingsPage.tsx`

- Adicionar entrada `{ key: "fees", label: "Taxas", icon: Percent, minRole: "admin" }` no array `allSections`
- Adicionar case `"fees"` no `renderContent()` retornando `<FeesSection />`

### `src/components/transactions/FinancialReport.tsx`

- Buscar `financial_settings` do workspace
- Calcular taxas e impostos sobre as transações aprovadas
- Exibir o card "Líquido" como `Faturamento - taxas - impostos` (ao invés de exibir o mesmo valor do faturamento)