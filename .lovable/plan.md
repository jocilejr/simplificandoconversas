

## Plano: Lembretes no Dashboard da Extensão + Rebranding "Chatbot Interno Origem Viva"

### 1. Logo e Rebranding

**Copiar a logo** `logo-ov.png` para `public/images/logo-ov.png` e `chrome-extension/icons/logo-ov.png`.

**App web (`AppSidebar.tsx`):**
- Substituir o ícone Zap + texto "Simplificando" pela imagem da logo + "Chatbot Interno Origem Viva"
- Ajustar tamanho do logo (32x32) no header da sidebar

**Extensão Chrome:**
- `content.js`: Substituir o logo-icon bolt + "SC Flows" por uma tag `<img>` com a logo + "Origem Viva"
- `popup.html`: Substituir "⚡ Simplificando Conversas" por logo + "Chatbot Interno Origem Viva"
- `manifest.json`: Atualizar nome para "Chatbot Interno Origem Viva"
- `styles.css`: Ajustar `.sc-logo-icon` para suportar imagem ao invés de gradiente

### 2. Lembretes no Dashboard da Extensão

**Backend (`extension-api.ts`) — expandir `/api/ext/dashboard`:**
- Adicionar query para buscar lembretes do usuário ordenados por:
  1. Lembretes de hoje (horário de Brasília, `America/Sao_Paulo`) primeiro
  2. Depois os mais recentes por `due_date`
- Limitar a 10 lembretes
- Retornar no response: `reminders: [{ id, title, description, due_date, completed, contact_name, phone_number }]`

**Extensão (`content.js`) — expandir `renderDashboard`:**
- Nova seção "Lembretes" após as execuções recentes
- Cada lembrete como card com:
  - Título + nome do contato
  - Badge de status: vermelho (atrasado), amarelo (hoje), cinza (futuro)
  - Data formatada
- Lembretes de hoje aparecem com destaque visual (borda dourada ou amarela)

**Extensão (`styles.css`):**
- Estilos para `.sc-reminder-item`, badges de status dos lembretes

### 3. Refinamento de layout

- Cores do header da extensão ajustadas para combinar com a identidade visual "Origem Viva" (tons dourados `#c5a55a` como accent)
- Logo no header com fundo transparente

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `public/images/logo-ov.png` | Copiar logo |
| `chrome-extension/icons/logo-ov.png` | Copiar logo |
| `chrome-extension/content.js` | Logo + seção lembretes no dashboard |
| `chrome-extension/styles.css` | Estilos logo + lembretes + accent dourado |
| `chrome-extension/popup.html` | Rebranding header |
| `chrome-extension/manifest.json` | Nome atualizado |
| `src/components/AppSidebar.tsx` | Logo + nome "Chatbot Interno Origem Viva" |
| `deploy/backend/src/routes/extension-api.ts` | Lembretes no endpoint dashboard |

