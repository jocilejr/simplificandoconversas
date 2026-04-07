

## Mover Recuperação Automática para a Página de Transações

### Problema
A recuperação automática está numa página separada. O usuário quer que tudo fique dentro da página de Transações, sem aba/página específica de recuperação.

### Mudanças

#### 1. Remover página "Recuperação" da sidebar
- Remover o item `{ title: "Recuperação", url: "/recuperacao", ... }` do `AppSidebar.tsx`
- Remover a rota `/recuperacao` do `App.tsx`

#### 2. Adicionar painel de configuração de recuperação automática na `TransactionsTable.tsx`
- Adicionar um **toggle** compacto no topo da página (próximo aos filtros de data) para ativar/desativar a recuperação automática
- Ao clicar num ícone de engrenagem ao lado do toggle, abrir um **Dialog** com:
  - Seletor de instância WhatsApp (para cada tipo: boleto, pix/cartão, yampi)
  - Delay entre mensagens (mínimo 20s)
  - Tempo de espera antes de enviar (minutos)
- A mensagem enviada automaticamente será **exatamente** a que está configurada no `RecoverySettingsDialog` (modal de ⚙️ de cada aba) — sem duplicar templates

#### 3. Atualizar `recovery_settings` para suportar instância por tipo
- A tabela atual tem um único `instance_name`. Vamos adicionar colunas:
  - `instance_boleto` (text) — instância para boletos
  - `instance_pix` (text) — instância para PIX/cartão
  - `instance_yampi` (text) — instância para carrinhos Yampi
- O campo `instance_name` existente continua como fallback

#### 4. Atualizar backend `auto-recovery.ts`
- Usar a instância correta por tipo de transação (`instance_boleto`, `instance_pix`, `instance_yampi`)
- Fallback para `instance_name` se não houver instância específica

#### 5. Adicionar visualização da fila na TransactionsTable
- Botão "Ver fila" que abre um Dialog mostrando os itens da `recovery_queue` (pendentes, enviados, falhos)
- Possibilidade de cancelar itens pendentes

### Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `src/components/AppSidebar.tsx` | Remover item "Recuperação" |
| `src/App.tsx` | Remover rota `/recuperacao` |
| `src/components/transactions/TransactionsTable.tsx` | Adicionar toggle + dialog de config + dialog de fila |
| `src/hooks/useRecoverySettings.ts` | Adaptar para novos campos de instância por tipo |
| `deploy/backend/src/routes/auto-recovery.ts` | Usar instância por tipo |

### Migração SQL (VPS)
```sql
ALTER TABLE recovery_settings 
  ADD COLUMN IF NOT EXISTS instance_boleto text,
  ADD COLUMN IF NOT EXISTS instance_pix text,
  ADD COLUMN IF NOT EXISTS instance_yampi text;
```

