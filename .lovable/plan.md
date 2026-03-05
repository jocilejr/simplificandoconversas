

## Plano: Redesign dos cards de Fluxos Automaticos

O layout atual tem problemas visuais: o emoji de antena quebra a sobriedade, o botao de ativar/parar ocupa muito espaco, e o card geral parece generico. Vou redesenhar seguindo a estetica corporativa escura do projeto.

### Alteracoes em `src/pages/ChatbotBuilder.tsx`

**Card do fluxo:**
- Remover o emoji e usar icone Lucide `Radio` para instancias
- Barra de acento superior com gradiente sutil ao inves de cor solida
- Separar visualmente o header (icone + nome + status) do metadata
- Botao de ativar/parar mais compacto: pill no canto ao inves de full-width
- Adicionar um separador sutil entre metadata e acoes
- Icone do fluxo com borda e fundo mais refinados (circular ao inves de quadrado)
- Status badge inline com dot colorido mais visivel
- Metadata em linha unica com separadores visuais (dot separator)
- Menu de tres pontos sempre visivel (nao so no hover) com opacidade reduzida
- Card "Novo Fluxo" com icone mais discreto e borda pontilhada mais sutil

**Header da pagina:**
- Adicionar subtitulo descritivo abaixo do titulo
- Botao "Novo Fluxo" com variante outline ao inves de filled para menos peso visual

**Estilo geral:**
- Cards com `rounded-xl` para bordas mais suaves
- Hover com elevacao e borda primary sutil
- Transicoes mais suaves em todos os elementos interativos

