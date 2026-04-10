

## Plano: Gestão de Domínios com Seleção para Área de Membros

### Conceito
Criar uma nova tabela `workspace_domains` para cadastrar domínios manualmente. Cada domínio terá um status (`active`/`inactive`). Na aba Domínio, o usuário poderá:
1. Cadastrar novos domínios
2. Ver quais estão ativos (com badge visual)
3. Remover domínios
4. Selecionar qual domínio ativo será usado na área de membros (salva em `delivery_settings.custom_domain`)

### Mudanças

**1. Nova tabela `workspace_domains`** (migração SQL)
- `id`, `workspace_id`, `domain` (text), `is_active` (boolean, default false), `created_at`
- RLS padrão do workspace (select/insert/update/delete)
- Constraint unique em `(workspace_id, domain)`

**2. Reescrever `DominioTab`** em `MemberAreaSettingsSection.tsx`
- Seção superior: lista de domínios cadastrados com badge verde (Ativo) ou cinza (Inativo) e botão de remover
- Input + botão "Adicionar Domínio" para cadastrar novos
- Seção "Domínio da Área de Membros": um `Select` dropdown mostrando apenas domínios ativos + opção "Domínio padrão". Ao selecionar, salva em `delivery_settings.custom_domain`
- Manter instruções de DNS e mensagem de entrega abaixo
- O campo `is_active` será controlado por um Switch ao lado de cada domínio na lista

**3. Registrar a tabela no `migrate-workspace.sql`** e `init-db.sql`
- Adicionar `workspace_domains` aos arrays de migração para garantir `workspace_id` e RLS na VPS

### Fluxo do usuário
```text
┌─────────────────────────────────────────┐
│  Domínios Cadastrados                   │
│  ┌───────────────────────────────────┐  │
│  │ membros.meusite.com  🟢 Ativo [x]│  │
│  │ app.meusite.com      ⚫ Inativo[x]│  │
│  └───────────────────────────────────┘  │
│  [ novo-dominio.com        ] [Adicionar]│
│                                         │
│  Domínio da Área de Membros             │
│  [ ▼ membros.meusite.com           ]   │
│  (apenas domínios ativos aparecem)      │
│                                         │
│  📋 Instruções de DNS ...               │
│  Mensagem de entrega: [________]        │
│  [Salvar Configurações]                 │
└─────────────────────────────────────────┘
```

