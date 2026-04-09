

# Redesign do DeliveryFlowDialog — Refinado e Minimalista

## Mudanças

### 1. `src/components/entrega/DeliveryFlowDialog.tsx` — Reescrever completo

**Etapa 1 — Dados do cliente (simplificado):**
- Remover campo "Nome do Cliente" (não é necessário para liberação)
- Apenas campo "Telefone" com placeholder elegante
- Botão "Continuar" compacto (`size="sm"`, sem `w-full`)
- Layout limpo, sem labels pesados — usar placeholder inline

**Etapa 2 — Método de pagamento (cards refinados):**
- Cards compactos e elegantes em vez de blocos grandes
- Ícones pequenos (h-4 w-4) dentro de círculos sutis (h-9 w-9, bg-muted)
- Texto em uma linha: título + descrição lado a lado
- Hover com `border-primary/40` e transição suave
- Sem sombras exageradas, sem `h-14 w-14`
- Botão "Voltar" como texto link, não como ghost button

**Etapa 3 — Processing:**
- Loader menor (h-5 w-5), texto discreto

**Etapa 4 — Resultado (card de lead no padrão InfoRow existente):**
- Usar o padrão `InfoRow` do projeto (ícone h-4 + label uppercase 10px + valor 13px)
- Layout em grid 2 colunas para telefone/email/cpf
- Produtos com badges `variant="secondary"` pequenas
- Link em `bg-muted/50` com `rounded-md`, fonte mono 13px
- Botão "Copiar" compacto (`size="sm"`)
- Botão "Gerar outro" como `variant="ghost" size="sm"` em vez de outline full-width

**Header do dialog:**
- Título com ícone menor (h-4 w-4)
- Badge de preço mais discreto
- `DialogDescription` para acessibilidade

### 2. Lógica ajustada

- Remover estado `customerName` e seu uso
- Na criação de conversa (quando lead não encontrado), usar string vazia ou o nome encontrado
- Na transação PIX, `customer_name` vem do lead encontrado (não do input removido)
- Validação: apenas telefone é obrigatório

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/entrega/DeliveryFlowDialog.tsx` | Reescrita completa com design refinado |

Nenhum outro arquivo precisa ser alterado — `ProductsTab.tsx` já está correto.

