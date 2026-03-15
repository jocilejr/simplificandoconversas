

## Problema

O arquivo `deploy/update.sh` foi editado localmente na VPS (provavelmente por um `chmod` ou edição manual anterior), e o `git pull` recusa sobrescrever. O próprio script faz `git pull` como primeiro passo, criando um loop: você não consegue rodar o script porque ele mesmo está "sujo".

## Solução

Modificar o `update.sh` para fazer `git checkout -- .` (ou `git stash`) **antes** do `git pull`, garantindo que mudanças locais nunca bloqueiem a atualização. Assim o script se auto-corrige a cada execução.

### Mudança no `deploy/update.sh`

Adicionar logo após o `cd "$REPO_ROOT"` (linha 14), antes do `git pull`:

```bash
# Discard any local changes to avoid merge conflicts
git checkout -- .
```

### Comando imediato para desbloquear a VPS agora

Enquanto isso, rode na VPS:

```bash
cd ~/simplificandoconversas && git checkout -- . && cd deploy && chmod +x update.sh && ./update.sh
```

Após o deploy desta mudança, o problema não acontecerá mais nas próximas atualizações.

