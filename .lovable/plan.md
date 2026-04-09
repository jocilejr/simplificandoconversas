

# LinkGenerator — Lógica PIX com Vinculação a Leads (sem @s.whatsapp.net)

## Alteração: `src/components/entrega/LinkGenerator.tsx`

### Fluxo da mutação (reescrever `mutationFn`)

1. Normalizar telefone com `normalizePhone(phone)` — resultado é apenas dígitos (ex: `5589981340810`)
2. Upsert em `member_products` — **sempre** (libera acesso na área de membros)
3. Insert em `delivery_link_generations` — **sempre**
4. **Se `paymentMethod === "pix"`**:
   - Buscar todas `conversations` do workspace
   - **Prioridade 1**: `normalizePhone(c.phone_number) === normalized` (match exato)
   - **Fallback**: `normalizePhone(c.phone_number).slice(-8) === normalized.slice(-8)` (últimos 8 dígitos)
   - Se nenhum match → criar novo contato em `conversations` com `remote_jid: normalized` (apenas número, sem sufixo), `phone_number: normalized`
   - Inserir transação em `transactions`: `type: 'pix'`, `status: 'aprovado'`, `amount: product.value`, `customer_phone: normalized`, `source: 'entrega_digital'`, `description: product.name`, `paid_at: now()`
5. Gerar link e retornar

### Regras importantes
- **NENHUM** `@s.whatsapp.net` — `remote_jid` recebe apenas o número normalizado
- Remover opção "Manual" do select (ficam PIX, Boleto, Cartão)
- Toast PIX: "Acesso liberado + pagamento PIX vinculado ao lead!"
- Toast Boleto/Cartão: "Acesso liberado e link gerado!"

### Tabela resumo

| Método | member_products | delivery_link_generations | transactions | conversations (match/criar) |
|--------|:-:|:-:|:-:|:-:|
| PIX | Sim | Sim | Sim (aprovado) | Sim |
| Boleto | Sim | Sim | Nao | Nao |
| Cartao | Sim | Sim | Nao | Nao |

## Arquivo alterado

| Arquivo | Mudanca |
|---------|---------|
| `src/components/entrega/LinkGenerator.tsx` | Logica PIX com match + transacao + remover Manual + sem @s.whatsapp.net |

Nenhuma migracao necessaria.

