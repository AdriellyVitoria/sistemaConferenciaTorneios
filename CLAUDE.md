# Instruções para o agente

Projeto: desafio técnico da PowerRev (Desenvolvedora Full Stack Júnior). Sistema de premiação de torneios para a Maria Clara.

## Leia antes de qualquer coisa

- @contexto.md — o problema, a usuária, a planilha, as regras de negócio e **todas as decisões já tomadas** (seção 11). É a fonte da verdade.
- @plano.md — arquitetura, banco de dados, fluxo de branches, etapas e checklist.

## Regras de trabalho

1. **Nunca faça commit, push, merge ou crie branch sem permissão explícita.** Todo comando git que altera o repositório é executado pela Adrielly. Sugira a mensagem do commit e espere.
2. **Uma etapa do plano por vez.** Não avance para a próxima sem os testes passando e sem a Adrielly aprovar.
3. **Não decida regra de negócio sozinho.** Se aparecer um caso que o `contexto.md` não cobre, pare, explique as opções e pergunte. Depois de decidido, registre no `contexto.md` e no `DECISIONS.md`.
4. **A planilha original `torneio-setembro.csv` não pode ser alterada.**
5. **Dinheiro sempre em centavos inteiros.** Nunca `float`.
6. **Responda em português do Brasil**, de forma clara e direta. A Adrielly precisa conseguir explicar cada decisão na sessão de retorno, então explique o porquê do que for feito.

## Estado atual

- Regras de negócio: decididas (D1 a D17 no `contexto.md`). D3 a D7 e D15 foram revisadas em 14/10/2026; D16 e D17 são novas. Na mesma data: D9 passou ao **maior resto** (regra única de arredondamento, inclusive entre times empatados) e todo item da aba Pendências exige "Ciente" ou correção, inclusive a D13.
- `testes/gerar_cenarios.py` usa o maior resto. Sem flag, **reescreve as planilhas de `testes/planilhas/` e o `site-oficial.json`**: para regenerar só os esperados, use `--so-esperado`. Não há Python na máquina: rodar num contêiner `python:3.12-slim`, com `testes/planilhas` montado somente leitura.
- D18 (leitura da planilha) decidida em 14/10/2026.
- Stack: Node.js 22 com TypeScript, Vue, MySQL 8 (Docker); conferência em segundo plano por tabela de tarefas no MySQL.
- Bibliotecas confirmadas: Express, Knex, Zod, Vitest. Monorepo com npm workspaces.
- Branch de trabalho: `feature/premiacao-torneios` (já existe e é a branch atual), saindo de `develop`.
- Etapa 0 (esqueleto): concluída em 14/10/2026. `docker compose up --build` sobe MySQL 8.4, API (3000), site simulado (4000) e web (5173); `npm test` roda os testes da API.
- Etapa 1, parte 1 (leitura da planilha, `api/src/dominio/planilha.ts`): pronta, aguardando aprovação.
- Próximo passo: **Etapa 1, parte 2** (comparação planilha × site), depois da aprovação da Adrielly.
