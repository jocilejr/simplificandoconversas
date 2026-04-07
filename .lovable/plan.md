
Objetivo: corrigir a recuperação para respeitar exatamente o tipo do bloco escolhido.

Diagnóstico confirmado:
- O erro atual está no bloco `pdf` de `deploy/backend/src/lib/recovery-dispatch.ts`.
- Hoje ele envia `media: "data:application/pdf;base64,..."`.
- A Evolution está respondendo: `Owned media must be a url or base64`.
- Ou seja: para PDF ela quer o arquivo em URL ou em base64 puro, não em data URI com prefixo.

O que ajustar:
1. Manter a regra simples e fixa por tipo:
   - `text` → envia texto
   - `pdf` → envia o PDF original como documento
   - `image` → converte o PDF para JPG e envia a imagem
2. No bloco `pdf`:
   - ler o arquivo PDF do disco usando `boleto_file`
   - converter para base64 puro
   - enviar `mediatype: "document"`
   - enviar `media` sem prefixo `data:application/pdf;base64,`
   - manter `fileName` e `mimetype: "application/pdf"`
3. No bloco `image`:
   - manter a conversão PDF → JPG
   - depois enviar o JPG em base64 puro também, para padronizar com o que a Evolution aceita melhor
   - não mexer na lógica de conversão, apenas no formato final do `media`
4. Adicionar um helper local no arquivo, algo como `cleanBase64()`, para remover prefixo `data:*;base64,` e espaços/quebras de linha antes do envio.
5. Melhorar os logs:
   - logar claramente `Sending PDF block` e `Sending IMAGE block`
   - logar o caminho do arquivo usado
   - logar o erro bruto da Evolution por tipo, sem ambiguidade

Arquivo afetado:
- `deploy/backend/src/lib/recovery-dispatch.ts`

Resultado esperado:
- Se o template tiver bloco `pdf`, o WhatsApp recebe somente o PDF
- Se o template tiver bloco `image`, o sistema converte o boleto e envia somente o JPG
- Não haverá mais dependência de URL pública para mídia
- O erro 400 da Evolution no bloco PDF deixa de ocorrer

Validação na VPS após a correção:
```bash
cd ~/simplificandoconversas/deploy
docker compose up -d --build backend

docker logs -f deploy-backend-1 2>&1 | grep -E "recovery-dispatch|Evolution sendMedia|Failed"
```

Checklist de teste dentro da VPS:
1. Testar um template com bloco `pdf` apenas
   - confirmar no WhatsApp que chegou um documento PDF
   - confirmar no log que não houve conversão para JPG
2. Testar um template com bloco `image` apenas
   - confirmar no WhatsApp que chegou uma imagem JPG
   - confirmar no log que houve `pdftoppm`
3. Testar um template misto (`text` + `pdf` ou `text` + `image`)
   - confirmar que cada bloco saiu no formato certo e na ordem certa

Detalhe técnico importante:
- Não precisa mudar banco, webhook, Nginx ou rota pública
- O problema está no payload enviado para a Evolution dentro do `recovery-dispatch.ts`
- A correção é pequena e focada: parar de mandar data URI no `pdf` e padronizar base64 puro nos blocos de mídia
