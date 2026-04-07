
Objetivo: alinhar o motor automático exatamente com a regra que você definiu na VPS:
- template é absoluto
- cada bloco deve ser enviado exatamente no formato do bloco
- conversão PDF → JPG só acontece quando existir bloco de JPG/imagem
- delay global da instância precisa ser respeitado no envio automático

Implementação

1. Tornar o template absoluto no backend
- Ajustar `deploy/backend/src/lib/recovery-dispatch.ts`.
- Remover os dois fallbacks atuais:
  - fallback para “primeiro template disponível”
  - fallback para `profiles.recovery_message_*`
- Nova regra:
  - buscar somente o template `is_default = true`
  - se não existir, ou se `blocks` vier vazio, marcar o item como `failed` com erro explícito e não enviar nada

2. Fazer o backend respeitar o tipo do bloco exatamente como o template define
- Hoje o backend trata:
  - `text` = texto
  - `pdf` = envia PDF
  - `image` = envia URL do próprio bloco
- Vou alinhar ao comportamento desejado:
  - `text`: envia texto com variáveis
  - `pdf`: envia o PDF do boleto, sem conversão
  - `image`/JPG: converte o boleto PDF em imagem e envia a imagem do boleto
- Ou seja: a conversão não ficará ligada ao bloco `pdf`; ficará ligada somente ao bloco de imagem/JPG.

3. Corrigir o significado do bloco de imagem no editor
- O modal já comunica que “Imagem do boleto” converte PDF em JPG, mas o backend hoje interpreta `image` como URL livre.
- Vou padronizar isso entre frontend e backend:
  - no template de recuperação, `image` passa a significar “imagem gerada do boleto”
  - se depois você quiser imagem externa/manual, isso deve ser um outro tipo de bloco no futuro, não esse atual

4. Adicionar endpoint de imagem do boleto na VPS
- Criar em `deploy/backend/src/routes/payment.ts` uma rota dedicada, algo como:
  - `GET /api/payment/boleto-image/:transactionId`
- Essa rota:
  - lê o PDF salvo em disco
  - converte a primeira página para JPG
  - retorna a imagem pronta
- Importante: isso serve tanto para o envio automático quanto para manter coerência com a visualização manual.

5. Adicionar suporte de conversão no container da VPS
- Atualizar `deploy/backend/Dockerfile` para instalar a ferramenta de conversão de PDF para JPG.
- Hoje o container não tem nada para isso.
- Depois do rebuild do backend na VPS, a conversão passa a funcionar no ambiente real.

6. Fazer o delay global ser respeitado de verdade
- Hoje o código lê `delay_seconds`, mas dentro de um recovery com múltiplos blocos ele usa um `setTimeout(2000)` fixo entre blocos.
- Isso quebra sua regra.
- Vou trocar essa lógica para usar o delay configurado da instância entre os blocos do próprio template.
- Resultado esperado:
  - se a instância estiver com 30s, cada bloco do template também respeita esse intervalo
  - não existirá um “2s fixo” escondido

7. Preservar a fila global por instância
- Manter a serialização por `instance_name` com `getMessageQueue(...)`
- Mas complementar com logs claros em `recovery-dispatch.ts`:
  - template carregado
  - quantidade e ordem dos blocos
  - delay resolvido para a instância
  - tipo real enviado em cada bloco
- Isso facilita sua verificação diretamente na VPS.

Arquivos que entram no plano
- `deploy/backend/src/lib/recovery-dispatch.ts`
- `deploy/backend/src/routes/payment.ts`
- `deploy/backend/Dockerfile`

Resultado esperado após implementar
```text
template default encontrado
→ somente os blocos dele são usados
→ sem fallback para profiles
→ sem fallback para outro template

bloco text
→ envia texto

bloco pdf
→ envia PDF

bloco image/jpg
→ converte boleto para JPG
→ envia imagem

delay da instância
→ respeitado entre os blocos e entre os envios da fila
```

Validação que vou orientar você a fazer na VPS depois
- rebuild do backend
- criar uma transação pendente de teste
- checar nos logs:
  - template default encontrado
  - bloco 1/2/3 com tipos corretos
  - delay aplicado da instância
  - ausência total de fallback
- conferir em `recovery_queue`:
  - `status = sent` quando tudo der certo
  - `status = failed` com mensagem explícita quando não houver template default
