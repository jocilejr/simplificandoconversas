

# Refinar Layout de Programação com Preview WhatsApp

## Visao Geral

Redesenhar completamente o modal de Programação de mensagens para campanhas de grupos, inspirado na aplicação whats-grupos. O novo layout terá:

1. **Layout split-screen**: formulário à esquerda, preview WhatsApp à direita
2. **Preview em tempo real**: simula exatamente como a mensagem aparecerá no WhatsApp, incluindo link preview com OG metadata (via microlink.io API)
3. **Opcao "Mencionar todos"** disponível em texto, áudio, vídeo e imagem
4. **Link Preview forçado** para mensagens de texto que contenham URLs
5. **Design profissional** com paleta WhatsApp escura e dourado (#c5a55a)

---

## Componente 1: `WhatsAppPreview.tsx` (NOVO)

Componente dedicado que renderiza uma simulação visual do WhatsApp. Inspirado 1:1 no componente do whats-grupos:

- **Barra superior** verde escuro com avatar do grupo e nome "Grupo"
- **Area de chat** com fundo padrão WhatsApp (#060a0e)
- **Bubble de mensagem** com tail e timestamp "12:00" + double-check azul
- **Tipos suportados**:
  - **Texto**: formatação WhatsApp (*bold*, _italic_, ~strike~, ```code```) + link preview card
  - **Imagem/Video**: thumbnail com caption
  - **Audio**: waveform estilizado
  - **Documento**: card com icone de arquivo
  - **Sticker**: imagem sem bubble
  - **Localização**: mapa placeholder + nome
  - **Contato**: card com nome, telefone e "Enviar mensagem"
  - **Enquete**: card com opções de voto
  - **Lista**: card com botão "Ver opções"
- **Link Preview Card**: usa `api.microlink.io` para fetch de OG image/title/domain. Mostra favicon do domínio, imagem OG, título e domínio
- **Empty state**: "Componha uma mensagem para ver o preview" com icone Sparkles
- **Barra inferior**: input fictício "Digite uma mensagem" + icone de mic

---

## Componente 2: `GroupScheduledMessageForm.tsx` (REESCRITO)

Reescrita completa do formulário para layout mais profissional:

- **Grid de tipos**: 2 linhas x 5 colunas com icones e labels, borda primary quando selecionado
- **Campos por tipo**:
  - Texto: Textarea + switches de "Mencionar todos" e "Link Preview"
  - Imagem/Video/Documento: Input URL + Input caption + checkbox "Mencionar todos"
  - Audio: Input URL + checkbox "Mencionar todos"
  - Sticker: Input URL apenas
  - Localização: Latitude, Longitude, Nome, Endereço
  - Contato: Nome, Telefone
  - Enquete: Pergunta, Opções dinâmicas, Selecionáveis
  - Lista: Título, Descrição, Botão, Footer, Seções com linhas dinâmicas
- **Agendamento** mantém a mesma lógica atual (once/daily/weekly/monthly/custom)
- **Opções**: "Mencionar todos" disponível para text, image, video, audio
- **Link Preview**: toggle visível apenas para tipo texto

---

## Componente 3: `GroupMessagesDialog.tsx` (REESCRITO)

O modal principal de Programação. Layout novo:

- **Dialog `max-w-5xl`** para acomodar o split
- **Quando `showForm = true`**: layout `grid grid-cols-[1fr_340px]`
  - Esquerda: formulário completo (tipo, conteúdo, agendamento, opções)
  - Direita: `WhatsAppPreview` com dados reativos do formulário
- **Quando `showForm = false`**: lista de mensagens existentes em largura total
- **Tabs de frequência** mantidas (Único, Diário, Semanal, Mensal, Avançado)
- **Cards de mensagem** existentes refinados com mais detalhes visuais

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/grupos/WhatsAppPreview.tsx` | **Criar** |
| `src/components/grupos/GroupScheduledMessageForm.tsx` | **Reescrever** |
| `src/components/grupos/GroupMessagesDialog.tsx` | **Reescrever** |

Nenhuma alteração de backend, hooks ou banco necessária.

