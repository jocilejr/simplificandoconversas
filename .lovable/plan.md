

## Diagnóstico

Os logs mostram que a sincronização **encontra mensagens com sucesso** (`Found 50 messages for Meire Rosana - Entregas`), mas a API da Evolution retorna dados paginados:

```
total: 5776, pages: 116, currentPage: 1, records: [50 itens]
```

O codigo atual so busca a **pagina 1** (50 mensagens de 5776 total). O parametro `limit: 500` e ignorado pela API, que usa paginacao propria de 50 por pagina.

Alem disso, a insercao de mensagens usa `.insert()` sem tratamento de conflito, entao mensagens duplicadas falham silenciosamente.

## Correcoes

### 1. Adicionar paginacao no findMessages

Fazer um loop buscando todas as paginas ate um limite razoavel (ex: 10 paginas = 500 mensagens recentes), usando o parametro `page` no body do POST.

### 2. Usar upsert para mensagens

Trocar `.insert()` por `.upsert()` com `onConflict: "external_id"` para evitar falhas silenciosas em duplicatas.

### Arquivo a editar
- `supabase/functions/evolution-proxy/index.ts`:
  - Linhas 450-473: adicionar loop de paginacao no findMessages (buscar paginas 1 ate N enquanto houver records)
  - Linha 576: trocar `.insert()` por `.upsert()` com conflito em `external_id`

