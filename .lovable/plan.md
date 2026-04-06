

# Unificar Contatos + Clientes em "Leads"

## Conceito

Criar uma página única **Leads** que cruza dados de `conversations` (contatos WhatsApp) com `transactions` (pagamentos) usando os **últimos 8 dígitos do telefone** como chave de correspondência. Isso elimina duplicidades e centraliza tudo num lugar só.

## Estrutura da página

```text
┌─────────────────────────────────────────────┐
│  Leads                          [Importar CSV] [+ Novo Lead]  │
│  125 leads                                                      │
├─────────────────────────────────────────────┤
│  [Busca por nome/telefone...]    [Tag ▼]                        │
├─────────────────────────────────────────────┤
│  [ Todos (125) | Pagaram (34) | Não Pagaram (91) ]              │
├─────────────────────────────────────────────┤
│  Nome  | Telefone | Tags | Status Pgto | Total Pago | Última msg│
│  João  | +55...   | VIP  | ✅ Pagou    | R$ 500     | Olá...    │
│  Maria | +55...   |      | ❌ Não pgou | —          | Oi...     │
└─────────────────────────────────────────────┘
```

Ao clicar numa linha, abre modal com **todos os dados unificados**: nome, telefone, CPF, email, tags, lista de transações daquele lead.

## Lógica de correspondência (últimos 8 dígitos)

```typescript
const normalizePhone = (phone: string) => phone.replace(/\D/g, "").slice(-8);
```

Para cada contato de `conversations`, busca transações cujo `customer_phone` termine com os mesmos 8 dígitos. Isso resolve variações de DDI/DDD.

## Alterações

### 1. Remover rotas e sidebar entries
- **`src/components/AppSidebar.tsx`**: Remover "Contatos" do `mainItems` e "Clientes" do `financeItems`. Adicionar "Leads" no `mainItems` com ícone `Users` e rota `/leads`.
- **`src/App.tsx`**: Remover import/rota de `Contacts` e `ClientesFinanceiro`. Adicionar rota `/leads`. Manter redirect de `/contacts` e `/clientes-financeiro` para `/leads`.

### 2. Criar hook `useLeads` (substituir `useContacts`)
- **`src/hooks/useLeads.ts`** (novo): 
  - Busca `conversations` + `contact_tags` (como hoje)
  - Busca `transactions` (todas)
  - Cruza por últimos 8 dígitos do telefone
  - Cada lead tem: dados do contato + `hasPaid` (boolean) + `totalPaid` (soma dos aprovados) + `transactions[]`
  - Filtros: busca textual, tag, e aba de pagamento (todos/pagaram/não pagaram)

### 3. Criar página `Leads.tsx` (substituir `Contacts.tsx`)
- **`src/pages/Leads.tsx`** (novo):
  - Tabs: **Todos** | **Pagaram** | **Não Pagaram**
  - Tabela com colunas: Nome, Telefone, Tags, Status Pagamento, Total Pago, Última Mensagem
  - Badge verde "Pagou" ou cinza "Não pagou"
  - Mantém funcionalidades existentes: criar contato, importar CSV, filtro por tag
  - Click na linha abre modal de detalhes do lead

### 4. Criar modal `LeadDetailDialog.tsx`
- **`src/components/leads/LeadDetailDialog.tsx`** (novo):
  - Dados pessoais: Nome, Telefone, CPF (do transaction), Email, Tags
  - Seção "Transações": lista todas as transações vinculadas a esse lead
  - Cada transação mostra: tipo, status, valor, data, botão "Baixar PDF" se boleto

### 5. Limpar arquivos antigos
- Remover `src/pages/Contacts.tsx` e `src/pages/ClientesFinanceiro.tsx`
- Remover `src/hooks/useContacts.ts`

## Resultado
- Sidebar: "Leads" substitui "Contatos" e "Clientes"
- Uma única página com visão completa de cada pessoa
- Filtragem fácil: quem pagou vs quem não pagou
- Sem risco de dados cruzados errados graças à correspondência por 8 dígitos

