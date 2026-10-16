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

### Senha da organizadora

As telas da Maria pedem uma senha, uma vez por aba do navegador. **A senha de demonstração é `organizadora-demo`.** A página pública e o link de cada time (`/publico/...` e `/time/...`) não pedem senha. O botão "Sair", no cabeçalho, esquece a senha.

Essa senha está escrita aqui e no `docker-compose.yml`, então **só serve para demonstração**. Para trocar: crie um `.env` a partir do `.env.example`, mude `ADMIN_SENHA` (pelo menos 8 caracteres, sem acento) e reinicie a API (`docker compose up -d api`). Não é login: não há usuário nem recuperação de senha (detalhes no [DECISIONS.md](DECISIONS.md), R3).

A página inicial lista os torneios. Por ela, a Maria cria um torneio (nome, prêmio, percentuais e forma de divisão) e sobe a planilha; as partidas aparecem aguardando o site oficial. O rodapé mostra se a API e o banco estão no ar. A API aplica as migrations do banco sozinha ao subir.

Para parar: `docker compose down`. Para apagar também os dados do banco: `docker compose down -v`.

## Testes

Pré-requisito: Node 22.

```bash
npm install
npm test                  # regras de negócio, API, site simulado e regras da tela; não precisa de banco
npm run test:integracao   # repositórios contra o MySQL do Docker (docker compose up -d mysql)
```

Os testes de integração usam um banco só deles, `torneios_teste`, recriado do zero a cada execução: os dados de desenvolvimento não são tocados.

## Usar a API

Toda rota, menos `/saude`, `/publico/:codigo` e `/time/:codigo`, pede a senha da organizadora no cabeçalho `Authorization: Bearer <senha>`; sem ela, a resposta é 401. Os exemplos usam a senha de demonstração numa variável:

```bash
S='Authorization: Bearer organizadora-demo'

# criar um torneio (prêmio em centavos: R$ 10.000,00 = 1000000)
curl -X POST localhost:3000/torneios -H "$S" -H 'content-type: application/json' \
  -d '{"nome":"Setembro/2026","premioCentavos":1000000,"percentuais":[50,30,20],"modoDivisao":"minutos"}'

# subir a planilha do torneio 1 (o arquivo vai direto no corpo; enviar de novo substitui)
curl -X PUT localhost:3000/torneios/1/planilha -H "$S" -H 'x-nome-arquivo: torneio-setembro.csv' \
  --data-binary @torneio-setembro.csv

# listar os torneios, o mais novo primeiro
curl -H "$S" localhost:3000/torneios

# ver o torneio, com as partidas e o status de cada uma
curl -H "$S" localhost:3000/torneios/1

# pendências (depois de o job conferir as partidas); cada uma tem uma "chave"
curl -H "$S" localhost:3000/torneios/1/pendencias

# dar Ciente numa pendência, desfazer, ou dar Ciente em todas as não bloqueantes
curl -H "$S" -X PUT    localhost:3000/torneios/1/pendencias/CHAVE/ciente
curl -H "$S" -X DELETE localhost:3000/torneios/1/pendencias/CHAVE/ciente
curl -H "$S" -X POST   localhost:3000/torneios/1/pendencias/ciente-de-todas

# corrigir o ID de uma partida (17 = o "id" interno da partida, de GET /torneios/1);
# ela volta para a fila e o job consulta o ID novo
curl -X PUT localhost:3000/torneios/1/partidas/17/id-partida -H "$S" -H 'content-type: application/json' \
  -d '{"idPartida":"#52241"}'

# calcular os prêmios (só quando o campo "calculo" do torneio diz podeCalcular: true);
# depois disso, o torneio fica travado
curl -H "$S" -X POST localhost:3000/torneios/1/calculo

# o resultado gravado, e o CSV para pagar no Excel (UTF-8 com BOM, separador ";")
curl -H "$S" localhost:3000/torneios/1/resultado
curl -H "$S" -OJ localhost:3000/torneios/1/resultado.csv

# os códigos dos links; a página pública e o link de cada time abrem sem senha
curl -H "$S" localhost:3000/torneios/1/links
curl localhost:3000/publico/CODIGO_PUBLICO
```

## Ver o banco

```bash
docker compose exec mysql mysql -utorneios -ptorneios torneios
```

### Ver a conferência acontecendo

A API confere as partidas no site oficial sozinha, em segundo plano: ao subir uma planilha, as partidas nascem "aguardando" e o job as consulta, 3 por vez. Para acompanhar, rode de tempos em tempos:

```bash
docker compose exec mysql mysql --default-character-set=utf8mb4 -utorneios -ptorneios torneios -e "
  SELECT id_partida, status_conferencia, tentativas, ultima_tentativa_em, proxima_tentativa_em, ultimo_erro
  FROM partidas WHERE torneio_id = 1 ORDER BY id"
```

As partidas passam de `aguardando` para `em_consulta` e depois `conferida` (ou `nao_encontrada`). Os dados oficiais de cada jogador ficam em `participacoes`. Para ver as novas tentativas, derrube o site em http://localhost:4000/demo: as partidas voltam para `aguardando`, com a tentativa somada, o erro e a próxima tentativa 1 min depois. Religue e espere. O log da API (`docker compose logs -f api`) mostra o resumo de cada rodada.

Dentro do MySQL: `SHOW TABLES;`, `DESCRIBE partidas;`, `SELECT * FROM torneios;`. Qualquer cliente gráfico (DBeaver, MySQL Workbench) também conecta em `localhost:3307`, usuário e senha `torneios`.

## Desenvolvimento sem Docker (opcional)

Com só o MySQL no Docker (`docker compose up mysql`), cada parte roda com recarga automática:

Fora do Docker, a API não lê o `.env`: defina a senha no terminal antes (`$env:ADMIN_SENHA='organizadora-demo'` no PowerShell, `export ADMIN_SENHA=organizadora-demo` no bash). Sem ela, a API não sobe.

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
