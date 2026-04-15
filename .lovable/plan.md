

# Plano: URL visual, tempo do último sync e status do auto sync

## Alterações

### `src/components/grupos/GroupSmartLinkTab.tsx`

**1. Coluna URL visual**
- Na tabela de grupos (linha 425-428), em vez de só mostrar um ícone de check/X, mostrar a URL real como link clicável (`<a href={gl.invite_url} target="_blank">`) truncado, com ícone de link externo. Se banido ou sem URL, mostrar badge "Sem URL".

**2. Indicador de último auto sync**
- Abaixo do card de sync error ou junto ao header dos grupos (linha 396-401), mostrar:
  - `last_successful_sync_at` como "há X segundos/minutos/horas" usando cálculo relativo com `Date.now() - new Date(ts).getTime()`
  - Se `last_sync_error` existir, mostrar badge vermelho "Falha" com tooltip do erro
  - Se não houver erro, badge verde "OK"
- Usar os campos já existentes no `SmartLink`: `last_successful_sync_at`, `last_sync_error`, `last_sync_error_at`

**3. Status visual do sync no header da tabela**
- Junto ao botão "Sincronizar", adicionar:
  - Badge com cor: verde "Sync OK" / vermelho "Sync Falhou" / cinza "Nunca sincronizado"
  - Texto "há Xs" atualizado automaticamente (o query já tem `refetchInterval: 15000`)

### Nenhuma alteração no backend
Todos os campos necessários já são retornados pela API (`last_successful_sync_at`, `last_sync_error`, `last_sync_error_at`).

