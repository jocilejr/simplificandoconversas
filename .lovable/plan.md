

# Fase 1: Criar sidebar com todas as abas + páginas placeholder

## Objetivo
Adicionar todas as páginas do Finance Hub (exceto Typebot Ranking) como rotas na sidebar, com páginas placeholder simples ("Em breve"). A implementação real de cada módulo será feita gradualmente nas próximas iterações.

## Novas abas na sidebar

Será criado um novo grupo "Financeiro" na sidebar com os itens:

| Item | Rota | Ícone |
|------|------|-------|
| Transações | `/transacoes` | `Receipt` |
| Clientes | `/clientes` | `UserCircle` |
| Recuperação | `/recuperacao` | `RefreshCw` |
| Gerar Boleto | `/gerar-boleto` | `FileText` |
| Grupos | `/grupos` | `UsersRound` |
| Área de Membros | `/area-membros` | `Crown` |
| Entrega Digital | `/entrega` | `Package` |
| Links Úteis | `/links-uteis` | `LinkIcon` |

## Arquivos alterados

### 1. `src/components/AppSidebar.tsx`
- Adicionar novo grupo "Financeiro" com os 8 itens acima

### 2. Novas páginas placeholder (8 arquivos)
- `src/pages/Transacoes.tsx`
- `src/pages/ClientesFinanceiro.tsx`
- `src/pages/RecuperacaoBoletos.tsx`
- `src/pages/GerarBoleto.tsx`
- `src/pages/GruposPage.tsx`
- `src/pages/AreaMembros.tsx`
- `src/pages/EntregaDigital.tsx`
- `src/pages/LinksUteis.tsx`

Cada página terá um layout simples com título e mensagem "Módulo em desenvolvimento".

### 3. `src/App.tsx`
- Adicionar as 8 novas rotas dentro do `ProtectedRoute`

## Próximos passos (não incluídos nesta fase)
Após aprovar, implementaremos cada módulo um por um, começando pelo que você preferir (ex: Transações → Clientes → Recuperação...).

