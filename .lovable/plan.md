

## Diagnóstico

Caso isolado: 1 mensagem (`3c6e69dc`) nasceu com `next_run_at = 2026-04-23` em vez de `2026-04-16`. As demais funcionam, então **não há bug sistêmico** no cálculo. Provavelmente foi um glitch pontual no momento do import/criação (ex: o `calculateNextRunAt` rodou num instante em que já passava de 16:00 daquela quinta, então avançou +7 dias corretamente — mas a mensagem só passou a ter o timer ativo depois disso).

Como o problema só aparece quando o `next_run_at` fica desalinhado do que o usuário vê no front, e o scheduler já tem um `safetySweep` rodando, a correção mais barata e segura é **defensiva**: detectar e auto-corrigir antes que vire incidente.

## Correção proposta

### 1. Auto-healing no `safetySweep` (`group-scheduler.ts`)
Para cada mensagem `weekly`/`daily` ativa, **recalcular o que `next_run_at` deveria ser agora** e comparar com o valor salvo. Se houver uma ocorrência válida mais próxima que o `next_run_at` salvo (ex: salvo=23/04, mas hoje 16/04 ainda cabe), atualizar o banco e recriar o timer.

Isso resolve qualquer caso futuro em ≤5min sem intervenção manual.

### 2. Log de alerta
Quando o sweep detectar e corrigir uma divergência, logar:
```
[scheduler] 🔧 Auto-healed msg <id>: next_run_at <old> → <new> (skipped occurrence detected)
```
Facilita identificar se vira recorrente.

### 3. Aceitar ambas convenções de chaves
No helper de cálculo, garantir que lê tanto `runTime`/`weekDays` quanto `time`/`weekdays` (alinhado com `data-mapping-compatibility-v2`). Defesa contra a mesma classe de bug.

## Arquivos
| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/lib/group-scheduler.ts` | Adicionar checagem de divergência no `safetySweep`. Garantir leitura de chaves lowercase + camelCase em `calculateNextRunAt`. |

## Resultado
- Caso isolado nunca mais bloqueia disparos por mais de 5min
- Sem mudança no fluxo de criação/edição (que está funcionando para o resto)
- Logs deixam claro quando o auto-healing age

## Comando VPS pós-deploy
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

