
Objetivo: corrigir definitivamente o problema “nó Pixel Meta não está marcando corretamente”, removendo falsos positivos de disparo e garantindo rastreio confiável em todos os caminhos de execução.

1) Diagnóstico consolidado (o que precisa ser corrigido)
- O backend da VPS tem lógica de Pixel Meta, mas o fluxo de disparo da extensão pode retornar sucesso antes da execução real (retorno 202 em background), mascarando falhas.
- O cancelamento pré-disparo na extensão cobre só `running/waiting` e ignora `waiting_click/waiting_reply`, o que pode bloquear novo disparo sem feedback claro.
- A função de execução do ambiente cloud não está em paridade com a da VPS para Pixel Meta (sem branch dedicada), criando comportamento inconsistente entre ambientes.
- Há fragilidade na resolução de telefone quando o contato está em `@lid`, o que pode reduzir/invalidar atribuição no evento.
- Existe um bloqueio de build (`rollup` não resolvido) que precisa ser removido para estabilizar pipeline.

2) Plano de implementação (arquivos e mudanças)
A. Corrigir build pipeline
- Arquivo: `package.json`
  - Adicionar `rollup` explicitamente em `devDependencies` (evitar dependência transitiva implícita do Vite).
- Arquivos de lock: `package-lock.json` e/ou `bun.lock`
  - Atualizar lockfile para refletir dependência explícita.
Resultado esperado: `vite build` deixa de falhar com `Cannot find package 'rollup'`.

B. Paridade total do Pixel Meta no executor cloud
- Arquivo: `supabase/functions/execute-flow/index.ts`
  - Implementar branch `metaPixel` para nós standalone.
  - Implementar branch `metaPixel` para steps dentro de `groupBlock`.
  - Aplicar a mesma regra da VPS:
    - busca por `selectedPixelId`;
    - fallback para primeiro pixel do usuário;
    - hash SHA-256 do telefone normalizado;
    - envio para Graph API;
    - tratamento explícito de `metaResult.error`.
  - Incluir logs estruturados de Pixel com prefixo consistente.
Resultado esperado: comportamento idêntico VPS/cloud para o nó Pixel Meta.

C. Tornar disparo da extensão determinístico (sem “falso sucesso”)
- Arquivo: `deploy/backend/src/routes/extension-api.ts` (rota `/trigger-flow`)
  - Ajustar cancelamento de execuções para incluir `waiting_click` e `waiting_reply`.
  - Antes de responder sucesso, fazer pré-validação de execução ativa para o mesmo contato+instância e retornar erro explícito se bloqueado.
  - Manter processamento assíncrono, mas retornar estado real de “aceito para execução” apenas após pré-validações.
Resultado esperado: quando o usuário “dispara”, ele recebe resposta coerente com a realidade e não um sucesso ilusório.

D. Melhorar resolução de telefone para atribuição correta
- Arquivos:
  - `deploy/backend/src/routes/extension-api.ts`
  - `deploy/backend/src/routes/execute-flow.ts`
- Mudanças:
  - Se `remoteJid` vier como `@lid`, resolver telefone antes do disparo e repassar `resolvedPhone`.
  - No bloco de Pixel, validar telefone normalizado (mínimo plausível) e registrar erro explícito quando inválido em vez de enviar evento “cego”.
Resultado esperado: aumento da qualidade de match e redução de eventos “ok” sem atribuição real.

E. Persistência de auditoria no histórico de execução
- Backend VPS já grava `results`; padronizar no cloud também.
- Arquivos:
  - `supabase/functions/execute-flow/index.ts` (salvar `results`)
  - Migração SQL para adicionar coluna `results jsonb` em `flow_executions` no ambiente cloud (idempotente).
Resultado esperado: diagnóstico por execução sem depender de grep em log.

3) Detalhes técnicos (seção técnica)
- Fluxo final de decisão do Pixel:
```text
nó metaPixel
  -> selectedPixelId existe?
      -> sim: buscar pixel por (id + user_id)
      -> não/erro: fallback primeiro pixel do user
  -> sem credencial? registrar erro em results
  -> com credencial:
      -> resolver telefone válido
      -> montar event_data (event_name, event_id, action_source, user_data, custom_data)
      -> POST Graph API
      -> registrar sucesso/erro detalhado em results + log
```
- Status de execução a tratar uniformemente: `running`, `waiting_click`, `waiting_reply` (e legado `waiting` quando existir).
- Sem mudanças em autenticação de usuários; apenas robustez de execução e rastreabilidade.

4) Validação (E2E obrigatório)
1. Build:
- Rodar build e confirmar ausência do erro de `rollup`.
2. Disparo manual/extensão:
- Disparar fluxo com nó Pixel para 2 contatos:
  - um com `@s.whatsapp.net`;
  - um com `@lid`.
3. Verificação de execução:
- Confirmar criação/atualização de `flow_executions` com `results` contendo `metaPixel: ok (...)` ou erro explícito.
4. Verificação funcional:
- Conferir logs do backend com prefixo Pixel.
- Confirmar no destino de eventos que os disparos chegaram com o nome de evento esperado.
5. Cenário de bloqueio:
- Forçar contato com execução em `waiting_reply` e validar que a UI recebe erro claro de bloqueio, não sucesso silencioso.
