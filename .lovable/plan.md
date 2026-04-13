

## Plano: Exibir URL GET no detalhe do Smart Link

### O que já existe
O backend já suporta o sufixo `-get` no slug (linha 1006 do `groups-api.ts`). Ao acessar `/api/groups/smart-link-redirect?slug=meu-grupo-get`, retorna a URL do grupo como texto puro em vez de fazer redirect 302.

### Mudança
Adicionar no detalhe do Smart Link (`GroupSmartLinkTab.tsx`) uma segunda linha de URL mostrando o endpoint GET, com botão de copiar:

```
URL Pública:  seudominio.com/r/g/meu-grupo          [Copiar]
URL GET:      seudominio.com/r/g/meu-grupo-get       [Copiar]
```

A URL GET retorna apenas o link do WhatsApp como texto puro — útil para integrações externas e automações.

### Arquivo

| Arquivo | Ação |
|---------|------|
| `src/components/grupos/GroupSmartLinkTab.tsx` | Adicionar linha com URL GET no detalhe |

Nenhuma mudança no backend necessária — o sufixo `-get` já funciona.

