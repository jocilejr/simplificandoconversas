

# Completar Área de Membros — Funcionalidades Restantes do Finance Hub

## Análise das Diferenças

Após comparar arquivo por arquivo, a implementação atual já está **95% completa**. Restam apenas 3 gaps funcionais:

## 1. Aba Ofertas — Métricas de Conversão (Vendas)

**Falta:** O Finance Hub exibe "X vendas" ao lado de cada oferta, contando membros ativos vinculados ao produto da oferta. A versão atual mostra views, cliques e CTR mas não mostra vendas.

**Alteração:** Adicionar query `offerConversions` em `MemberOffersTab` dentro de `AreaMembros.tsx` que conta `member_products` ativos por `product_id` de cada oferta. Exibir o número com badge verde "X vendas" na listagem.

## 2. Aba Atividade — Auto-close de Sessões Órfãs + Botão de Teste

**Falta:**
- O Finance Hub fecha automaticamente sessões sem heartbeat há mais de 5 minutos (sessões órfãs)
- Botão "Simular sessão de teste" para debug

**Alteração em `MemberActivityTab.tsx`:**
- Adicionar lógica de auto-close na query de sessões (update `ended_at` para sessões sem heartbeat recente)
- Adicionar botão de simulação que insere uma sessão de teste

## 3. Realtime para `member_sessions`

**Falta:** A tabela `member_sessions` precisa estar habilitada para realtime no Supabase para que a subscription funcione.

**Alteração:** Migration SQL com `ALTER PUBLICATION supabase_realtime ADD TABLE public.member_sessions;`

---

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/AreaMembros.tsx` | Adicionar query de conversões na aba Ofertas + exibir "vendas" |
| `src/components/membros/MemberActivityTab.tsx` | Auto-close órfãs + botão simular sessão |
| Migration SQL | Habilitar realtime para `member_sessions` |

Estimativa: 3 alterações pontuais, sem novos componentes.

