
# Correção: Follow Up com dados errados + Envios repetidos + Conversão JPG

## 3 problemas identificados

### 1. Follow Up mostra transações que não são boletos
**Causa raiz**: No webhook (`payment.ts` linha 681 e 723), quando o Mercado Pago envia um evento de pagamento que não é PIX, o sistema classifica como `"boleto"` por exclusão:
```
type: mpData.payment_method_id === "pix" ? "pix" : "boleto"
```
Isso significa que cartão de crédito, débito e qualquer outro método vira `type: "boleto"`. O Follow Up filtra por `type = "boleto"` e pega tudo.

**Correção**: Mapear corretamente o `payment_method_id` do Mercado Pago. Só classificar como `"boleto"` quando `payment_method_id` for `"bolbradesco"`, `"pec"` (lotérica) ou similar. Cartão fica como `"cartao"`, outros ficam como o valor real do MP.

Mapeamento:
- `pix` → `"pix"`
- `bolbradesco`, `"pec"` → `"boleto"`
- `credit_card`, `debit_card`, `prepaid_card` → `"cartao"`
- Qualquer outro → valor original do MP

Isso afeta 2 pontos no `payment.ts` (linhas 681 e 723) e 1 ponto no webhook de status update (linha 623).

Adicionalmente, o Follow Up (`useBoletoRecovery.ts`) deve filtrar **apenas** transações que tenham `source = "mercadopago"` E que foram **criadas pelo sistema** (não por webhook aleatório). Vou adicionar um filtro extra: apenas boletos que tenham `metadata->boleto_file` (ou seja, que realmente tiveram um PDF gerado/baixado).

### 2. Sistema repetindo envios infinitamente
**Causa raiz**: O cron `auto-recovery.ts` roda a cada 10 segundos e:
1. Encontra itens `pending` com mais de 60s
2. **Deleta** o registro do `recovery_queue`
3. Chama `dispatchRecovery` novamente
4. O `dispatchRecovery` verifica duplicatas mas como o registro foi deletado, não encontra nada
5. Cria um novo registro e envia de novo
6. Volta ao passo 1 — **loop infinito**

**Correção**: O cron NÃO deve deletar o registro. Em vez disso, deve atualizar o status para `"processing"` e chamar a lógica de envio diretamente (não via `dispatchRecovery` que cria novo registro). Se o envio funcionar, marca como `"sent"`. Se falhar, marca como `"failed"`.

Na prática, como o `dispatchRecovery` já faz tudo (verificação de template, envio, etc.), a solução mais limpa é:
- O cron marca o item como `"processing"` (não deleta)
- Chama `dispatchRecovery` com um flag para pular a verificação de duplicata
- Ou melhor: **remover o cron completamente**. O sistema é event-driven. Se um item ficou stuck, significa que o backend reiniciou no meio do envio. A solução correta é ter um endpoint manual para reprocessar, não um cron que cria loops.

Vou **desabilitar o cron** e manter apenas o endpoint manual `/process` para casos excepcionais. O dispatch event-driven já é suficiente.

### 3. Conversão PDF→JPG não funcionou
**Causa provável**: O backend ainda não foi reconstruído na VPS após a adição do `poppler-utils` no Dockerfile. O código e o Dockerfile já estão corretos. O usuário precisa fazer o rebuild.

Para confirmar, vou pedir ao usuário para verificar na VPS se o `pdftoppm` está disponível no container.

## Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/payment.ts` | Mapear `payment_method_id` corretamente (bolbradesco/pec→boleto, credit_card→cartao, pix→pix) |
| `deploy/backend/src/routes/auto-recovery.ts` | Desabilitar o processamento automático do cron (remover o loop que deleta e re-despacha) |
| `deploy/backend/src/index.ts` | Remover o `cron.schedule` do auto-recovery |
| `src/hooks/useBoletoRecovery.ts` | Adicionar filtro extra para garantir que só boletos reais apareçam (verificar `source = mercadopago` e existência de `boleto_file` no metadata, ou filtrar client-side) |

## Comandos de verificação na VPS (pós-deploy)

```bash
# Verificar se poppler-utils está instalado
docker compose exec backend which pdftoppm

# Rebuild
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend

# Verificar tipos de transação no banco
docker compose exec postgres psql -U postgres -d postgres -t -c "SELECT type, count(*) FROM transactions GROUP BY type;"

# Limpar recovery_queue duplicada
docker compose exec postgres psql -U postgres -d postgres -c "DELETE FROM recovery_queue WHERE status = 'pending';"

# Monitorar logs
docker logs deploy-backend-1 --tail 50 2>&1 | grep "recovery-dispatch"
```
