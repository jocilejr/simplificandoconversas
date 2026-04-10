

## Plano: Corrigir resolução de domínio nos links da Área de Membros

### Problema
- `LinkGenerator.tsx` usa `settings.custom_domain || window.location.origin` — não garante `https://` e não substitui `{link}` na mensagem
- `MemberClientCard.tsx` usa `window.location.origin` fixo, ignora o domínio configurado
- DNS mostra `window.location.hostname` que pode ser URL/domínio em vez do IPv4 real

### Correções

**1. `src/components/entrega/LinkGenerator.tsx`** (linha 192-195)
- Buscar `settings.custom_domain` (que vem da seleção em Configurações > Área de Membros > Domínio)
- Fallback para `window.location.origin`
- Se `custom_domain` existir e não tiver protocolo, prefixar com `https://`
- Substituir `{link}` na `delivery_message` se presente, senão anexar no final

**2. `src/components/membros/MemberClientCard.tsx`** (linha 43)
- Adicionar query para buscar `delivery_settings.custom_domain` do workspace
- Usar esse domínio (com `https://` se necessário) como base do `memberUrl`
- Fallback para `window.location.origin`

**3. `src/components/settings/MemberAreaSettingsSection.tsx`** (linha 223, 334)
- Nas instruções de DNS, trocar `window.location.hostname` por um campo de input onde o usuário informa o IPv4 da VPS, ou exibir um texto genérico instruindo a usar o IPv4 do servidor (já que `window.location.hostname` pode retornar o domínio e não o IP)

### Lógica de domínio (compartilhada)
```text
1. delivery_settings.custom_domain (selecionado pelo usuário)
2. Se não houver → window.location.origin (URL padrão do servidor)
3. Se custom_domain não tiver "http" → prefixar com "https://"
4. Remover trailing slash
```

### Lógica de `{link}` no LinkGenerator
```text
Se delivery_message contém "{link}" → substituir pelo link
Senão → anexar link na última linha
```

### Arquivos alterados
- `src/components/entrega/LinkGenerator.tsx`
- `src/components/membros/MemberClientCard.tsx`
- `src/components/settings/MemberAreaSettingsSection.tsx`

