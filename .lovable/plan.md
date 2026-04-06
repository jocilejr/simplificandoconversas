

# Correção: URLs dos endpoints SMTP apontando para lugar errado

## Problema
O hook `useSmtpConfig.ts` está chamando os endpoints de teste e verificação SMTP usando a URL do Supabase (`${baseUrl}/functions/v1/email/...`), mas esses endpoints existem no backend Express da VPS em `/api/email/test` e `/api/email/verify-smtp`. O mesmo acontece com o endpoint de stats em `useEmailSends.ts`.

Por isso, ao clicar "Verificar Conexão" ou "Enviar Teste", a requisição vai para o Supabase (que retorna 404), e a mensagem de erro genérica aparece.

## Solução
Alterar as URLs nos hooks para usar o caminho relativo `/api/email/...` (que o Nginx da VPS roteia para o backend Express), em vez de `${baseUrl}/functions/v1/email/...`.

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/hooks/useSmtpConfig.ts` | `testSmtp`: trocar URL para `/api/email/test`. `verifySmtp`: trocar URL para `/api/email/verify-smtp` |
| `src/hooks/useEmailSends.ts` | `stats`: trocar URL para `/api/email/stats` |

Todas as 3 ocorrencias de `${baseUrl}/functions/v1/email/...` serão substituídas por caminhos relativos `/api/email/...`.

