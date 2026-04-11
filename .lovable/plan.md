

## Plano: PIX apenas exibe chave configurada (sem cobrança OpenPix)

### Mudança
O fluxo PIX na Área de Membros **não deve gerar cobrança** via gateway. Deve apenas:

1. Mostrar tela de confirmação com valor e pergunta "Tem certeza que deseja pagar via PIX?"
2. Ao confirmar, exibir a chave PIX configurada na oferta (`offer.pix_key`) para o usuário copiar manualmente
3. Registrar apenas a intenção de pagamento localmente (sem chamada ao OpenPix)

### Arquivo: `src/components/membros/PaymentFlow.tsx`

- Adicionar step `pix-confirm` ao tipo `Step`
- `handlePix` → navega para `pix-confirm` (sem chamada ao backend)
- Tela `pix-confirm`: mostra valor formatado, mensagem "O valor é R$ X,XX, tem certeza que deseja efetuar no PIX?", botão "Confirmar"
- Ao confirmar → vai direto para step `pix` mostrando a chave PIX da oferta (`offer.pix_key`) com botão de copiar
- Remover toda lógica de chamada ao backend para PIX (sem `createCharge` para PIX)
- Remover step `pix-loading` do fluxo PIX
- Manter a tela `pix` simplificada: ícone QR, chave PIX em texto copiável, botão "Copiar Chave PIX"

### O que NÃO muda
- Boleto continua gerando cobrança real via backend
- Cartão continua abrindo link externo
- Preenchimento automático de nome/CPF permanece

