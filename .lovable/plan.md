

## Plano: Auto-criar tabelas no update.sh + Pré-preencher prompts de IA

### Problema
1. O `update.sh` não executa o `fix-member-tables.sql`, então as colunas `ai_persona_prompt`, `greeting_prompt` e `offer_prompt` podem não existir na VPS
2. Os campos de prompt na UI aparecem vazios mesmo existindo scripts hardcodados no backend

### Alterações

**1. `deploy/update.sh`** — Adicionar execução do `fix-member-tables.sql` logo após o `migrate-workspace.sql` (linha ~461):

```bash
echo "   → Applying member tables fix..."
docker compose exec -T postgres psql -U postgres -d postgres < "$DEPLOY_DIR/fix-member-tables.sql"
echo "✓ Member tables fix aplicado"
```

**2. `src/components/settings/MemberAreaSettingsSection.tsx`** — No bloco `if (settings && !loaded)` (linhas 40-48), pré-preencher os campos com os defaults hardcodados do backend quando estiverem vazios:

- **ai_persona_prompt**: `"Você é uma mulher cristã de 57 anos, líder de uma comunidade de orações. Fala com carinho, como uma amiga próxima. Nunca usa termos de marketing."`
- **greeting_prompt**: O system prompt completo com categorias, regras absolutas e tom por perfil (extraído de `member-access.ts` linhas 249-253)
- **offer_prompt**: O system prompt completo do pitch de oferta com estrutura dos 3 balões (extraído de `member-access.ts` linhas 383-391)

Os defaults serão constantes no topo do componente. Ao salvar, o valor vai para o banco e o backend passa a usar o valor salvo em vez do hardcoded.

### Resultado
- `./update.sh` cria automaticamente todas as tabelas e colunas necessárias
- Ao abrir Configurações > Área de Membros > Ajustes, os campos já aparecem preenchidos com o script atual da IA
- Você pode editar e salvar a qualquer momento

