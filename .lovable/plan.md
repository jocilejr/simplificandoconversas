
Objetivo: corrigir definitivamente o erro **404 ao adicionar Meta Pixel** no ambiente VPS (`POST /rest/v1/meta_pixels`) e melhorar o diagnóstico no frontend.

1) Diagnóstico consolidado
- O erro não é de autenticação (sessão válida), é de rota/tabela no backend self-hosted.
- O `POST /rest/v1/meta_pixels` retorna 404, indicando que a API REST não está “enxergando” `public.meta_pixels` naquele momento.
- Pelos scripts atuais, isso pode ocorrer em dois cenários:
  - migração não aplicada com sucesso em algum update;
  - cache de schema da camada REST não recarregado após criar/alterar tabela.
- O log no frontend aparece como `{}` porque o erro é tratado como `Error` simples e perde campos estruturados.

2) Implementação proposta

A. Fortalecer o deploy para evitar 404 pós-migração (arquivo `deploy/update.sh`)
- Após o bloco SQL de migração:
  - validar explicitamente existência da tabela (`to_regclass('public.meta_pixels')`);
  - se não existir, abortar update com erro claro.
- Forçar recarga do schema REST após migração:
  - executar `NOTIFY pgrst, 'reload schema';`
  - e reiniciar serviço `postgrest` como fallback forte.
- Manter `nginx` restart ao final (já existe), garantindo config/roteamento atualizado.

B. Melhorar diagnóstico no frontend (arquivo `src/hooks/useMetaPixels.ts`)
- Trocar tratamento `onError(err: Error)` por parser de `unknown`:
  - extrair `message`, `details`, `hint`, `code`, `status` quando disponíveis.
- Mostrar toast com mensagem útil:
  - exemplo para 404: “Tabela de pixels não disponível no backend. Rode o update da VPS novamente.”
- Manter `console.error` estruturado para facilitar suporte.

C. (Opcional, mas recomendado) reduzir ruído de 503 em ambiente não-VPS (`src/hooks/useWhatsAppInstances.ts`)
- Detectar resposta conhecida da função stub (“requires self-hosted backend”).
- Interromper polling contínuo nesse caso (evita spam de requests/logs) e manter status “Servidor offline”.

3) Validação (fim-a-fim)
- Executar update na VPS e confirmar:
  - migração concluída sem erro;
  - serviço REST recarregado/reiniciado.
- Testar na UI:
  - abrir Configurações → Aplicação;
  - adicionar pixel;
  - validar no DevTools que `POST /rest/v1/meta_pixels` retorna **201/200**, não 404.
- Validar UX de erro:
  - se backend estiver inconsistente, toast deve explicar ação corretiva (não erro genérico).
- Se etapa opcional for aplicada:
  - abrir aba Conexões em ambiente não-VPS e confirmar que não há loop infinito de 503.

4) Impacto e risco
- Baixo risco: mudanças localizadas em script de update e tratamento de erro no hook.
- Sem alteração de regra de negócio dos fluxos; foco em confiabilidade de deploy + observabilidade.
