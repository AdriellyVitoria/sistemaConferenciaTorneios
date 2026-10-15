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
- Etapa 1, parte 1 (leitura da planilha, `api/src/dominio/planilha.ts`): concluída.
- Etapa 1, parte 2 (comparação planilha × site, `api/src/dominio/comparacao.ts`, regras na D19): concluída. Dados do site de setembro (D15) em `api/test/fixtures/site-setembro.json`.
- Etapa 1, parte 3 (classificação, `api/src/dominio/classificacao.ts`): concluída. Critério sem "divisão igual", que é da parte 4.
- Etapa 1, parte 4a (maior resto, `api/src/dominio/divisao.ts`): concluída. Soma dos pesos zero lança `SomaDosPesosZero`; a regra de negócio desse caso vem no 4c.
- Etapa 1, parte 4b (prêmio por time, `api/src/dominio/premio.ts`): concluída. D20: percentuais somam 100 (`erroDosPercentuais`, para a criação do torneio reaproveitar) e o prêmio é dividido entre as posições pelo maior resto, com empate para a melhor colocada.
- Etapa 1, parte 4c (rateio entre jogadores, `api/src/dominio/rateio.ts`): pronta, aguardando aprovação. D21: no modo kills, 0 kills recebe R$ 0; time sem kills é dividido pelos minutos. **Com ela, a etapa 1 está completa.**
- Forma de trabalho: em cada pedaço, escrever os testes, **rodar e mostrar que falham**, e só depois implementar.
- Etapas 0 e 1 integradas na `develop` por pull request.
- Etapa 2, pedaço 2a (consulta de partida, `site-oficial-simulado/src/app.ts`): concluído. `GET /partidas/40923`; dados montados somente leitura no Docker.
- Etapa 2, pedaço 2b (demora e falhas): concluído. Demora 2–10 s por `SITE_DEMORA_MIN_MS`/`SITE_DEMORA_MAX_MS`; falha = 503 `indisponivel`.
- Etapa 2, pedaço 2c (modo demonstração, página em `http://localhost:4000/demo`): concluído. Etapa 2 completa e integrada.
- Etapa 3, pedaço 3a (banco: migrations 002 a 004 e repositórios em `api/src/repositorios/`): concluído. Testes de integração com `npm run test:integracao` (precisa do `docker compose up -d mysql`), num banco `torneios_teste` recriado a cada execução.
- Quem tenta consultar de novo é o job da **etapa 4**, em dois casos: 503 e site sem resposta (tempo esgotado).
- Etapa 3, pedaço 3b (API: `POST /torneios`, `GET /torneios/:id`, `PUT /torneios/:id/planilha`): concluído. D22 (reenvio substitui, travado depois do cálculo) e D23 (dois times por partida) decididas. Sem login: limitação registrada no DECISIONS.md.
- Etapa 3, pedaço 3c (telas): concluído; etapa 3 integrada por pull request. Nova lista de torneios e excluir torneio: melhorias pendentes (plano.md, seção 9), sem implementar. `GET /torneios` (lista); web com vue-router 4, Vitest (regras puras em `web/src/dominio/`, testes em `web/test/`) e fontes IBM Plex locais (`@fontsource`). Páginas: lista, novo torneio (prêmio em reais convertido só com inteiros, percentuais 50/30/20 com soma ao vivo) e torneio (envio da planilha com confirmação de substituir, erros por linha, partidas).
- Visual: protótipo em `C:\Users\mende\Downloads\prototipo\prototipo` (três HTML de editor de design; usar só o visual, tokens em `web/src/estilos.css`).
- Etapa 4, pedaço 4a (cliente do site e agenda das novas tentativas): concluído.
- Etapa 4, pedaço 4b (job de conferência): concluído.
- Etapa 4, pedaço 4c (tela de progresso e "tentar agora"): pronto, aguardando aprovação. Decisões no `DECISIONS.md` (seção da etapa 4c).
- Pedaço visual (base de tokens em `web/src/estilos.css` e nova lista de torneios): concluído.
- Etapa 5, pedaço 5a (pendências e Ciente, só API): pronto, aguardando aprovação. Decisões no `DECISIONS.md`.
- Próximo passo: **Etapa 5, pedaço 5b** (correção do ID), depois da aprovação do 5a.
