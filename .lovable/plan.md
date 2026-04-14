

# Reorganizar Sidebar + Relatório como aba inicial + Integração Meta Ads

## 1. Reorganizar Sidebar — `src/components/AppSidebar.tsx`

**Financeiro primeiro (topo), Operacional embaixo:**

| Seção | Itens (ordem) |
|---|---|
| **Financeiro** | Relatório, Leads, Transações, Gerar Boleto, Área de Membros, Entrega Digital, Follow Up |
| **Operacional** | Dashboard, Fluxos, E-mail, Lembretes, Grupos, Links Úteis |
| **Sistema** | Disparar Fluxo, Configurações |

Trocar a ordem dos arrays `mainItems` → `operationalItems` (fica embaixo) e `financeItems` (fica em cima, com Relatório em primeiro).

## 2. Rota inicial → Relatório — `src/App.tsx`

Alterar a rota `/` de `Navigate to="/dashboard"` para `Navigate to="/relatorio"`.

## 3. Integração Meta Ads — Novo sistema

### 3a. Tabela `meta_ad_spend` (migração)

```sql
CREATE TABLE public.meta_ad_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  campaign_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, date, campaign_name)
);
ALTER TABLE public.meta_ad_spend ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workspace ad spend"
  ON public.meta_ad_spend FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid())
    OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
```

### 3b. Integração Meta nas Configurações — `src/components/settings/IntegrationsSection.tsx`

Adicionar nova integração `meta_ads` no array `INTEGRATIONS`:
- Campos: `access_token` (token de longa duração) e `ad_account_id` (ID da conta de anúncios)
- Ícone: 📊
- Descrição: "Gastos com anúncios Meta/Facebook"

### 3c. Hook `useMetaAdSpend` — Novo arquivo

- Busca gastos do período na tabela `meta_ad_spend`
- Função de sincronização manual via edge function

### 3d. Edge Function `sync-meta-ads` — Nova

- Recebe `workspace_id`, `start_date`, `end_date`
- Busca credenciais Meta do workspace em `platform_connections`
- Chama a API do Meta: `GET /{ad_account_id}/insights?time_range=...&fields=spend,campaign_name&level=campaign`
- Upsert dos dados na tabela `meta_ad_spend`

### 3e. Relatório Financeiro — `src/components/transactions/FinancialReport.tsx`

- Importar `useMetaAdSpend` 
- Somar gastos Meta no card de "Deduções" como linha "Meta Ads"
- Subtrair do valor líquido

## Arquivos alterados/criados

- `src/components/AppSidebar.tsx` — reordenar seções
- `src/App.tsx` — rota inicial
- `src/components/settings/IntegrationsSection.tsx` — adicionar Meta Ads
- `src/hooks/useMetaAdSpend.ts` — novo hook
- `supabase/functions/sync-meta-ads/index.ts` — nova edge function
- `src/components/transactions/FinancialReport.tsx` — incluir gastos Meta nas deduções
- Migração SQL — tabela `meta_ad_spend`

