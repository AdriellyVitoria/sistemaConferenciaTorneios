# Sistema de premiação de torneios

Confere as partidas da planilha da Maria Clara no site oficial do jogo e divide o prêmio entre os jogadores, mostrando a cada um como o seu valor foi calculado.

> Em construção. O problema e as regras estão em [contexto.md](contexto.md), o plano em [plano.md](plano.md) e as decisões em [DECISIONS.md](DECISIONS.md).

## Como rodar

Pré-requisito: Docker (com Docker Compose).

```bash
docker compose up --build
```

| Serviço | Endereço |
|---|---|
| Tela (Vue) | http://localhost:5173 |
| API | http://localhost:3000/saude |
| Site oficial simulado | http://localhost:4000/partidas/40923 (ID só com os números) |
| Modo demonstração do site | http://localhost:4000/demo (derrubar e religar o site) |
| MySQL | `localhost:3307` (usuário `torneios`, senha `torneios`) |

A página inicial mostra se a API e o banco estão no ar. A API aplica as migrations do banco sozinha ao subir.

Para parar: `docker compose down`. Para apagar também os dados do banco: `docker compose down -v`.

## Testes

Pré-requisito: Node 22.

```bash
npm install
npm test                  # regras de negócio, API e site simulado; não precisa de banco
npm run test:integracao   # repositórios contra o MySQL do Docker (docker compose up -d mysql)
```

Os testes de integração usam um banco só deles, `torneios_teste`, recriado do zero a cada execução: os dados de desenvolvimento não são tocados.

## Usar a API

```bash
# criar um torneio (prêmio em centavos: R$ 10.000,00 = 1000000)
curl -X POST localhost:3000/torneios -H 'content-type: application/json' \
  -d '{"nome":"Setembro/2026","premioCentavos":1000000,"percentuais":[50,30,20],"modoDivisao":"minutos"}'

# subir a planilha do torneio 1 (o arquivo vai direto no corpo; enviar de novo substitui)
curl -X PUT localhost:3000/torneios/1/planilha -H 'x-nome-arquivo: torneio-setembro.csv' \
  --data-binary @torneio-setembro.csv

# ver o torneio, com as partidas e o status de cada uma (também pelo navegador)
curl localhost:3000/torneios/1
```

## Ver o banco

```bash
docker compose exec mysql mysql -utorneios -ptorneios torneios
```

Dentro do MySQL: `SHOW TABLES;`, `DESCRIBE partidas;`, `SELECT * FROM torneios;`. Qualquer cliente gráfico (DBeaver, MySQL Workbench) também conecta em `localhost:3307`, usuário e senha `torneios`.

## Desenvolvimento sem Docker (opcional)

Com só o MySQL no Docker (`docker compose up mysql`), cada parte roda com recarga automática:

```bash
npm run dev -w api                     # http://localhost:3000
npm run dev -w site-oficial-simulado   # http://localhost:4000
npm run dev -w web                     # http://localhost:5173
```

## Estrutura

```
api/                     API em Node + TypeScript (Express, Knex, Zod)
site-oficial-simulado/   simulação do site oficial do jogo
web/                     telas em Vue 3 + Vite
testes/                  planilhas de teste, dados do site simulado e resultados esperados
```
