

## Problema

Atualmente, o media-manager classifica arquivos como "Permanente" ou "Temporário" baseado apenas na **localização física** (`/media-files/{userId}/` = permanente, `tmp/` = temporário). Isso faz com que mídias recebidas via webhook do Evolution (áudios, imagens, vídeos de conversas) que ficam na raiz sejam marcadas como "Permanente", quando na verdade são efêmeras.

O correto: **somente arquivos referenciados em fluxos de chatbot, regras de recuperação, produtos e materiais da área de membros** devem ser "Permanente". Todo o resto é temporário e pode ser limpo após 24h.

## Solução

### 1. Backend: `deploy/backend/src/routes/media-manager.ts`

Inverter a lógica de classificação:

- **Antes**: `isTemporary` baseado na pasta (`tmp/` = temporário, raiz = permanente)
- **Depois**: `isTemporary` baseado no `inUse` — só é permanente se estiver referenciado no banco (fluxos, regras, produtos, materiais, mensagens agendadas)

Mudanças concretas:
- Remover `isTemporary: false` e `isTemporary: true` hardcoded na montagem dos objetos de arquivo
- Após calcular o `inUseSet`, definir: `isTemporary = !inUse` (arquivo em uso = permanente, arquivo não referenciado = temporário)

### 2. Backend: Adicionar rota de auto-limpeza

Criar endpoint `DELETE /api/media-manager/cleanup` que:
- Lista todos os arquivos do usuário
- Calcula o `inUseSet` (mesma lógica existente)
- Deleta arquivos que **não estão em uso** E têm **mais de 24h** de criação
- Retorna contagem de arquivos removidos e espaço liberado

### 3. Frontend: `src/components/settings/MediaManagerSection.tsx`

- Adicionar botão "Limpar temporários (+24h)" que chama o endpoint de cleanup
- Exibir confirmação antes de executar

### Resumo técnico

```text
Arquivo raiz (/media-files/{userId}/foto.jpg)
  └─ Referenciado em chatbot_flows?     → Permanente ✅
  └─ Referenciado em recovery_rules?    → Permanente ✅
  └─ Referenciado em delivery_products? → Permanente ✅
  └─ Referenciado em member_materials?  → Permanente ✅
  └─ Referenciado em group_scheduled?   → Permanente ✅
  └─ Nenhuma referência?                → Temporário 🕐 (limpar após 24h)

Arquivo tmp (/media-files/{userId}/tmp/audio.ogg)
  └─ Sempre temporário                  → Temporário 🕐
```

