

# Migrar tema para azul (whats-grupos) + Redesign da Fila

## 1. Trocar paleta de cores — `src/index.css`

Substituir todas as variáveis CSS verdes (`142 70% 45%`) pelo azul do whats-grupos (`210 75% 52%`):

| Variável | Atual (verde) | Novo (azul) |
|---|---|---|
| `--primary` | `142 70% 45%` | `210 75% 52%` |
| `--accent` | `142 70% 45%` | `215 20% 18%` |
| `--accent-foreground` | `0 0% 100%` | `210 75% 65%` |
| `--ring` | `142 70% 45%` | `210 75% 52%` |
| `--sidebar-primary` | `142 70% 45%` | `210 75% 52%` |
| `--sidebar-ring` | `142 70% 45%` | `210 75% 52%` |
| `--background` | `225 35% 5%` | `215 28% 7%` |
| `--card` | `225 30% 8%` | `215 25% 10%` |
| `--popover` | `225 30% 10%` | `215 25% 12%` |
| `--secondary` | `225 25% 12%` | `215 20% 18%` |
| `--muted` | `225 25% 12%` | `215 20% 15%` |
| `--muted-foreground` | `215 15% 50%` | `215 15% 55%` |
| `--border` | `225 20% 14%` | `215 20% 18%` |
| `--input` | `225 20% 14%` | `215 20% 20%` |
| `--sidebar-background` | `225 40% 4%` | `215 30% 6%` |
| `--sidebar-accent` | `225 25% 10%` | `215 20% 12%` |
| `--sidebar-border` | `225 20% 8%` | `215 20% 12%` |
| `--info` | `210 100% 52%` | `210 75% 52%` |

Manter `--success: 142 60% 45%` (verde para indicadores de sucesso — semanticamente correto).

## 2. Redesign da Fila — `src/components/grupos/GroupQueueTab.tsx`

**Mover Anti-Spam para popup de configuração:**
- Remover o card Anti-Spam visível na tela
- Adicionar um botão de engrenagem (`Settings2`) no topo da fila que abre um `Dialog` com as configurações de Anti-Spam
- O Dialog conterá os 3 campos (max mensagens, janela de tempo, delay) + botão salvar

**Redesign visual da fila:**
- Stat cards no topo com visual mais limpo
- Lista de itens da fila com layout profissional: avatar/ícone do tipo de mensagem, informações hierárquicas, badges de status com cores mais sofisticadas, timestamps alinhados
- Barra de progresso sutil para itens "processing"
- Empty state com ilustração/ícone centralizado
- Header da fila com título + botão engrenagem + contagem

## 3. Arquivos alterados

- `src/index.css` — paleta de cores
- `src/components/grupos/GroupQueueTab.tsx` — redesign completo

