

## Plano: Usar apenas a URL pública configurada (sem fallback)

### Problema
Três arquivos usam `window.location.origin` como fallback quando `custom_domain` não está definido. O usuário quer que **apenas** o domínio configurado em `delivery_settings.custom_domain` seja utilizado, sem fallback.

### Alterações

**1. `src/components/leads/LeadDetailDialog.tsx`** (linha 274)
- Adicionar query para buscar `delivery_settings.custom_domain` (mesmo padrão do `LinkGenerator.tsx`)
- Substituir `window.location.origin` pelo `custom_domain` do banco
- Se `custom_domain` não estiver configurado, mostrar `toast.error("Configure o domínio da Área de Membros nas configurações")` e não gerar link

**2. `src/components/entrega/DeliveryFlowDialog.tsx`** (linha 306)
- Remover fallback `|| window.location.origin`
- Se `custom_domain` estiver vazio, mostrar erro ao invés de gerar link com domínio errado

**3. `src/components/membros/MemberClientCard.tsx`** (linha 61)
- Remover `|| window.location.origin` do retorno de `getMemberDomain()`
- Se não houver domínio configurado, exibir aviso

**4. `src/components/entrega/LinkGenerator.tsx`** (linha 196)
- Remover `if (!domain) domain = window.location.origin;`
- Se domínio vazio, mostrar erro

### Resultado
Todos os links de acesso de membros usarão exclusivamente `https://membros.origemdavida.online` (ou qualquer domínio configurado em Configurações > Área de Membros > Domínio). Se nenhum domínio estiver configurado, o sistema avisará o usuário ao invés de gerar links incorretos.

