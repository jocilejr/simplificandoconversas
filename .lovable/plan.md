

## Problema

1. Botão "Limpar temporários" causa insegurança — não fica claro que arquivos de fluxos/membros estão protegidos
2. Todos os arquivos aparecem misturados numa lista só
3. Arquivos da área de membros (materiais no banco) não aparecem no gerenciador

## Solução: Abas por origem + campo `source` na API

### 1. Backend: `deploy/backend/src/routes/media-manager.ts`

Refatorar `computeInUseSet` para retornar `Map<string, string>` (relativePath → source) em vez de `Set<string>`:

| Source | Tabelas verificadas |
|--------|-------------------|
| `"flow"` | `chatbot_flows`, `boleto_recovery_rules` |
| `"member"` | `delivery_products`, `member_area_materials` |
| `"group"` | `group_scheduled_messages` |
| `"boleto"` | pasta `boletos/` |
| `"temporary"` | todo o resto (sem referência no banco) |

Cada arquivo retornado pela API ganha o campo `source`. O endpoint `/cleanup` continua protegendo tudo que não seja `"temporary"` (>24h) ou `"boleto"` (>30d). Para boletos, matching por nome base (PDF↔JPG).

### 2. Frontend: `src/components/settings/MediaManagerSection.tsx`

Substituir os filtros "Local" por componente `<Tabs>` com 5 abas:

| Aba | Filtra por | Contagem |
|-----|-----------|----------|
| **Todos** | sem filtro | total |
| **Fluxos** | `source === "flow"` | N |
| **Área de Membros** | `source === "member"` | N |
| **Grupos** | `source === "group"` | N |
| **Boletos** | `source === "boleto"` | N |
| **Temporários** | `source === "temporary"` | N |

- Botão "Limpar temporários (+24h)" aparece **somente** na aba Temporários
- Badges mostram origem específica ("Fluxo", "Membros", "Grupo") em vez de genérico "Permanente"
- Filtro de tipo (áudio/imagem/vídeo/PDF) permanece funcional dentro de cada aba

### Arquivos alterados
- `deploy/backend/src/routes/media-manager.ts` — `computeInUseMap`, campo `source`, matching base name boletos
- `src/components/settings/MediaManagerSection.tsx` — abas por origem, cleanup só na aba temporários

