

# Simplificar "Gerar Boleto" — apenas Mercado Pago, apenas Boleto

## Resumo

A página será exclusiva para gerar **boletos** via **Mercado Pago**. Remove seletor de gateway, seletor de tipo de cobrança, e toda referência a OpenPix.

## Alterações — `src/pages/GerarBoleto.tsx`

1. **Remover imports**: `useCreatePaymentOpenpix`
2. **Simplificar state**: remover `type` e `gateway` do form (sempre `type: "boleto"`, gateway fixo Mercado Pago)
3. **Remover lógica OpenPix**: variável `createPaymentOP`, condicional no submit, `isPending` simplificado
4. **Remover da UI**:
   - Seletor "Gateway" (linhas 105-119)
   - Seletor "Tipo de Cobrança" (linhas 121-134)
   - Aviso OpenPix (linhas 136-140)
5. **Título**: "Gerar Cobrança" → **"Gerar Boleto"**
6. **Botão submit**: texto fixo **"Gerar Boleto"**
7. **Submit**: chamar direto `createPaymentMP.mutateAsync({ ...payload, type: "boleto" })`

## Resultado

Formulário limpo: Nome, CPF, Telefone, Valor, Descrição → botão "Gerar Boleto". Sem opções de gateway ou tipo.

