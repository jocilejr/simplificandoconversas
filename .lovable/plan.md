

## Plano: Múltiplos Smart Links com Cards + Detalhe

### Conceito

A aba Smart Link passa a ter 3 estados visuais:

1. **Lista de cards** — cada smart link criado aparece como um card compacto mostrando slug, instância, quantidade de grupos e cliques. Botão "+" para criar novo.
2. **Formulário de criação** — mesmo fluxo atual (selecionar instância → buscar grupos → slug → criar). Botão voltar retorna à lista.
3. **Detalhe do smart link** — ao clicar num card, abre o dashboard completo (URL, stats, tabela de grupos, editar, excluir). Botão voltar retorna à lista.

### Mudanças

#### 1. `src/components/grupos/GroupSmartLinkTab.tsx` — reescrever

Substituir a lógica atual de "smartLink único" por navegação interna com `useState<"list" | "create" | string>`:

- **`view === "list"`**: grid de cards (`smartLinks.map(...)`) + botão "Novo Smart Link"
  - Cada card mostra: slug, instância, nº de grupos, badge ativo/inativo
  - `onClick` → `setView(smartLink.id)`
- **`view === "create"`**: formulário de criação (código atual do form, sem alterações na lógica)
  - Após criar com sucesso → volta para `"list"`
- **`view === id`**: dashboard do smart link selecionado (código atual do dashboard)
  - Busca `smartLinks.find(s => s.id === view)`
  - Botão "← Voltar" no topo

#### 2. `src/hooks/useGroupSmartLinks.ts` — stats por link

- Alterar a query de stats para aceitar um `smartLinkId` dinâmico em vez de usar fixo `smartLinks[0]`
- Exportar `useSmartLinkStats(id)` separado ou passar o ID como parâmetro

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/grupos/GroupSmartLinkTab.tsx` | Reescrever (lista + detalhe) |
| `src/hooks/useGroupSmartLinks.ts` | Ajustar stats query |

