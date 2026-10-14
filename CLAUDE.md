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

- Regras de negócio: decididas (D1 a D15 no `contexto.md`).
- Stack: Node.js com TypeScript, Vue, MySQL; conferência em segundo plano por tabela de tarefas no MySQL.
- Branch de trabalho: `feature/premiacao-torneios`, saindo de `develop` (a ser criada pela Adrielly).
- Próximo passo: **Etapa 0 — Esqueleto**.

## Pendências antes da etapa 0

- Confirmar as bibliotecas propostas: Express, Knex, Zod, Vitest.
- Definir quantas kills o site simulado registra para Falcões na partida `#40923` (com 63 ou mais, Falcões ultrapassa Tubarões no desempate).
