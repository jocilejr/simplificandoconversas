

## Diagnóstico Confirmado: Cliques Reais Classificados como Bot

### Causa Raiz

A lista de `botPatterns` no `link-redirect.ts` (linha 8-18) inclui o padrão **`"whatsapp"`**. Quando o usuário clica no link dentro do WhatsApp, o navegador in-app do WhatsApp envia um User-Agent que contém a string "WhatsApp" — por exemplo: `Mozilla/5.0 ... WhatsApp/2.24.x`. Isso faz com que `isBotUA = true`, e o código retorna HTML com meta tags OG em vez de processar o clique real.

Resultado: **100% dos cliques vindos do WhatsApp são tratados como bot**. O `processClick()` nunca executa, o fluxo nunca é retomado.

Os logs confirmam: apenas mensagens "Bot detected" aparecem, zero "Resumed flow".

### Evidências dos Dados

| Campo | Valor | Interpretação |
|-------|-------|---------------|
| Backend logs link-redirect | Só "Bot detected" | Nenhum clique humano processado |
| tracked_links clicked=true | Existe em alguns | Meta-refresh do HTML pode ter acionado via browser normal |
| flow_executions status | completed, updated_at = mesmo que waiting_click | Nenhuma atualização posterior pelo clique |
| grep "Resumed flow" | Vazio | Flow nunca foi retomado após clique |

### Plano de Correção

**Arquivo: `deploy/backend/src/routes/link-redirect.ts`**

1. **Trocar `"whatsapp"` por padrões específicos de bot do WhatsApp** (linhas 8-18)
   - Substituir `"whatsapp"` por `"whatsapp/2"` (o crawler do WhatsApp usa UA como `WhatsApp/2.x.x` sem o prefixo Mozilla, enquanto o navegador in-app usa `Mozilla/... WhatsApp/...`)
   - Alternativa mais segura: usar `"whatsapp/"` seguido de verificação se NÃO contém `"mozilla"` — mas a forma mais simples é usar o padrão correto do crawler

2. **Adicionar logging para cliques humanos** (após linha 38)
   - Logar quando um clique humano é detectado: UA, código, execution_id
   - Logar resultado do processClick: status da execução encontrado, se resume foi chamado

3. **Mesma correção no edge function** (`supabase/functions/link-redirect/index.ts`)
   - Aplicar a mesma mudança no padrão de bot para manter paridade

**Arquivo: `supabase/functions/link-redirect/index.ts`**

4. **Mesma troca de padrão `"whatsapp"` → padrão mais específico** (linhas 8-18)

### Detalhes Técnicos

O User-Agent do **crawler/preview do WhatsApp** é algo como:
```
WhatsApp/2.23.20.0 A
```

O User-Agent do **navegador in-app do WhatsApp** é algo como:
```
Mozilla/5.0 (Linux; Android 13) ... WhatsApp/2.24.1.6
```

A correção precisa distinguir entre eles. A abordagem mais robusta:
- Tratar como bot se UA contém `"whatsapp"` MAS **não** contém `"mozilla"`
- Isso captura o crawler (que não tem "Mozilla") mas permite o in-app browser (que tem "Mozilla")

Alternativamente, remover `"whatsapp"` da lista de bots e confiar apenas no `tooFast` para o preview do WhatsApp (que é buscado nos primeiros segundos).

