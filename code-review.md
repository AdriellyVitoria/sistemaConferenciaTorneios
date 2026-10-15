# Code review — sistema de premiação de torneios

> Revisão feita em 15/10/2026, na branch `feature/premiacao-torneios` (último commit `0a8a027`).
> Só leitura: nenhum arquivo do projeto foi alterado e nenhum comando git foi rodado. O Docker não foi derrubado nem reconstruído; os testes de borda rodaram no banco `torneios_teste`, nunca no de desenvolvimento.

## Resumo

O núcleo está acima do nível júnior. O dinheiro é calculado só com inteiros (BigInt no maior resto), há teste de propriedade para garantir que a soma fecha, a conferência usa SKIP LOCKED, recibo em milissegundos e ordem de travas pensada, e quase todas as decisões estão justificadas por escrito. Os pontos fracos estão nas bordas: as rotas da Maria, abertas, anulam o sigilo prometido pelos links dos times; entradas maiores que as colunas do banco viram erro 500; e a entrega ainda não está pronta (README "em construção", DECISIONS longo demais para quem avalia, um arquivo solto na raiz).

**Nota para júnior: 8,5/10.** Com os itens de "Corrija antes de entregar" resolvidos, 9.

---

## Verificação

| Comando | Resultado |
|---|---|
| `npm test` | **476 passam, 0 falham**: API 219 (22 arquivos), web 231 (19), site simulado 26 (3). ~6 s |
| `npm run test:integracao` | **161 passam, 0 falham** (12 arquivos), ~50 s. Rodei **duas vezes**: as duas passaram, sem instabilidade |
| Build da web (`vue-tsc --noEmit` + `vite build`) | Passa, sem erro de tipo. 176 kB de JS (62 kB gzip). Gerei o build no scratchpad, para não escrever em `web/dist` |
| `tsc --noEmit` na API e no site simulado | Passa |

Possível fragilidade: `api/test/integracao/conferencia.test.ts:271` mede tempo de parede (`toBeLessThan(2_000)`). Numa máquina de CI lenta pode falhar sem motivo real.

**Testes de borda que rodei** (script no scratchpad, chamando o domínio e o banco de teste):

| Caso | Resultado |
|---|---|
| Nick com 81 caracteres na planilha | `lerPlanilha` aceita; o INSERT falha com `ER_DATA_TOO_LONG` → **500** |
| ID com 25 dígitos | Igual: **500** |
| Kills `5000000000` | `ER_WARN_DATA_OUT_OF_RANGE` → **500** |
| Corrigir o ID para 30 dígitos | **500** |
| Site devolve `vencedor: "lobos"` com times `["Lobos","Corvos"]` | A classificação cria um time fantasma `lobos` com 1 vitória; o cálculo lança erro |
| Célula do CSV começando com tab + `=` | Sai sem o apóstrofo |
| Data `01/01/0001` | Aceita |

---

## 🔴 Crítico

### 1. As rotas da Maria, abertas, anulam o sigilo dos links dos times (D11)
`api/src/app.ts:23-29`, `api/src/rotas/resultado.ts:57` e `:67`, `DECISIONS.md:169`

- **Problema:** `GET /torneios/:id/resultado` devolve o valor de todos os jogadores de todos os times, e `GET /torneios/:id/links` devolve **todos os códigos dos times**. Nenhuma das duas tem proteção, e os IDs são sequenciais (1, 2, 3...). O jogador que recebe `http://host:5173/time/<código>` já conhece o endereço: basta abrir `http://host:5173/api/torneios/1/links` (o proxy do `vite preview` repassa) e pegar o link de qualquer time.
- **Por que importa:** o `DECISIONS.md:169` diz *"Os links dos times premiados usam token (D11), então só quem recebeu o link vê os valores do time"*. Hoje isso não é verdade. A falta de login está documentada, mas a consequência dela para a D11 não está, e um avaliador que teste vai achar em dois minutos. A D11 é a sua resposta ao "por que eu recebi só isso?", um dos pontos centrais do desafio.
- **Sugestão (em ordem de custo):**
  1. **Mínimo, 15 min:** corrigir o texto da limitação. Algo como: "Sem login, quem chegar à API vê tudo, inclusive os códigos. Os tokens só protegem de verdade quando apenas `/publico` e `/time` estão expostos na internet (proxy reverso), com as telas da Maria só na rede local."
  2. **Melhor, 1 a 2 h:** uma senha única de administradora no `.env` (`ADMIN_SENHA`), conferida por um middleware em tudo que não é `/saude`, `/publico` ou `/time`. A tela pede a senha uma vez e guarda em `sessionStorage`. Não é login de verdade, mas fecha o furo e é fácil de explicar.
     ```ts
     const abertas = /^\/(saude|publico|time)(\/|$)/;
     app.use((req, res, next) =>
       abertas.test(req.path) || req.get('authorization') === `Bearer ${config.ADMIN_SENHA}`
         ? next()
         : res.status(401).json({ erro: 'Acesso só da organizadora.' }));
     ```
     Comparar com `crypto.timingSafeEqual` seria o ideal; para o tamanho do projeto, não é essencial.

---

## 🟠 Importante

### 2. Valor maior que a coluna do banco vira 500, sem a linha do Excel
`api/src/dominio/planilha.ts:207-208`, `:234-238`, `:259-266`; colunas em `api/src/banco/migrations/003_cria_partidas.ts:15` (`id_partida` 20), `004_cria_linhas_planilha.ts:19-24` (`partida` 200, `time`/`nick` 80, `INT UNSIGNED`)

- **Problema:** a leitura aceita qualquer tamanho de texto e qualquer inteiro "seguro" do JavaScript (até 9×10¹⁵). O MySQL está em modo estrito (`STRICT_TRANS_TABLES`, conferido no contêiner) e recusa o INSERT. O mesmo vale para a correção do ID (`validarIdPartida`).
- **Por que importa:** a D18 promete "todos os erros juntados, com a linha do Excel". Um ID colado com dígitos a mais (erro de digitação comum) faz a Maria ver "Erro inesperado no servidor. Tente de novo.", e tentar de novo não resolve.
- **Sugestão:** limites no domínio, com a mesma frase das outras validações. Ex.: nick e time até 80, ID até 19 dígitos, minutos e kills até, digamos, 100 000 (nenhuma partida tem isso). Num lugar só (`planilha.ts`) e reaproveitado pela correção de ID. Um teste por limite.

### 3. Resposta do site é validada no formato, mas não na coerência
`api/src/conferencia/site-oficial.ts:52-59`, consequência em `api/src/dominio/classificacao.ts:34` e `api/src/dominio/rateio.ts:63`

- **Problema:** o Zod aceita `vencedor` que não é nenhum dos dois `times`, jogador cujo `time` não é da partida, lista de jogadores vazia e um `id` diferente do consultado. Com `vencedor: "lobos"` (grafia diferente de `"Lobos"`), a classificação cria um time fantasma com 1 vitória e sem jogadores, e o cálculo lança `O time lobos tem prêmio, mas nenhum minuto...` (confirmado no teste de borda).
- **Por que importa:** é o tipo de dado que vem do "site instável". Pelo desenho (D3 e D16), a Maria **não tem como corrigir**: o site é a verdade e ela só edita o ID. O torneio ficaria travado para sempre com um 500. Com o simulador isso não acontece; com o site real, pode.
- **Sugestão:** um `superRefine` no esquema: `vencedor` ∈ `times`, todo `jogador.time` ∈ `times`, pelo menos um jogador por time e `id` igual ao consultado. Fora disso: `resposta_invalida` (já é tentada de novo e aparece na aba "Aguardando o site" com o motivo). Custa uns 20 minutos, com teste.

### 4. Erro de regra no cálculo vira 500 genérico
`api/src/dominio/rateio.ts:63`, `api/src/app.ts:43`

- **Problema:** a frase de `rateio.ts` foi escrita para a Maria, mas o `tratarErros` troca por "Erro inesperado no servidor".
- **Por que importa:** a Maria clica em "Calcular" e não sabe o que fazer. Com o item 3 corrigido fica quase impossível de acontecer, mas a mensagem é o que ela vê se acontecer.
- **Sugestão:** uma classe `ErroDeRegra` no domínio; `calcularTorneio` captura e devolve `{ tipo: 'impossivel', mensagem }`, e a rota responde 409 com a frase.

### 5. README incompleto, e é um entregável
`README.md:5`

- **Problema:** "Em construção" e sem a seção **"Por que essa stack"**, que o enunciado pede pelo nome. Também não explica o roteiro de uso (criar → subir planilha → pendências → calcular → links), o modo demonstração com intervalos curtos nem as rotas `/publico` e `/time`. O comentário de `npm run test:integracao` ("repositórios contra o MySQL") descreve menos do que os testes fazem.
- **Por que importa:** é a primeira coisa que o avaliador abre. Sei que é a etapa 8; fica aqui porque é o que mais pesa na primeira impressão.
- **Sugestão:** (1) um comando para subir; (2) **demonstração em 5 passos** com setembro, incluindo um `.env` de demo (demora 200–800 ms, intervalos `2000,4000,8000`); (3) "Por que essa stack", em 5 linhas, levando para o DECISIONS; (4) as limitações conhecidas em 3 bullets (sem login, sem deploy, Pix fora).

### 6. O DECISIONS.md tem 118 KB e é um diário, não um resumo
`DECISIONS.md:1-4` e o arquivo inteiro

- **Problema:** são cerca de 880 linhas organizadas por etapa. O cabeçalho ainda diz "D1 a D17" (já são 24) e "é completado na etapa 8". O que o enunciado pede (decisões, alternativas e **o que ficou de fora e por quê**) existe, mas espalhado.
- **Por que importa:** o enunciado diz que o DECISIONS "importa tanto quanto o código". Ninguém lê 118 KB antes de uma entrevista de 1 hora. O conteúdo é ótimo; o problema é achar.
- **Sugestão:** no topo, **uma página**: (a) as 8 a 10 decisões que mais mudaram o produto (site como verdade, Ciente em vez de editar, maior resto, tabela de tarefas com SKIP LOCKED, links por time, cálculo congelado); (b) **o que ficou de fora por tempo**, em tabela; (c) limitações conhecidas (login, relógio, item 1). O diário vira "Registro detalhado", logo abaixo ou num `docs/decisoes-detalhadas.md`.

### 7. Arquivo solto na raiz: `tatus`
`tatus` (raiz)

- **Problema:** é a saída colorida de um `git log` (com códigos ANSI), provavelmente de um `git status` digitado errado com redirecionamento. Não está no `.gitignore`, e o `git status` limpo indica que **foi commitado** (a confirmar: `git ls-files tatus`).
- **Por que importa:** um avaliador olhando a estrutura vê isso logo na raiz. É barato de evitar.
- **Sugestão:** apagar e commitar a remoção.

---

## 🟡 Melhoria

### 8. Fuso horário: o risco real dos "dois relógios"
`api/src/banco/conexao.ts:44`, `api/src/banco/migrations/003_cria_partidas.ts:30`, `api/src/repositorios/torneios.ts:101`. Ver a seção "Os dois itens que você já conhecia".

### 9. Lote em `Promise.all`: uma consulta lenta segura as outras duas
`api/src/conferencia/job.ts:69`

- **Problema:** o próximo lote só começa quando as 3 consultas terminam. Uma de 10 s deixa duas vagas paradas.
- **Por que importa:** com 28 partidas, o tempo total fica perto de "lotes × consulta mais lenta". Não é defeito; é throughput.
- **Sugestão:** um pool com 3 vagas, em que cada vaga reserva a próxima partida assim que termina. Não vale mexer agora; é uma boa resposta se perguntarem "e com 100 partidas?".

### 10. Proteção contra fórmula no CSV incompleta
`api/src/dominio/csv-resultado.ts:35`

- **Problema:** cobre `= + - @`, mas não tab (`\t`) nem `\r` no início, que a OWASP também lista.
- **Sugestão:** `/^[=+\-@\t\r]/`. Uma linha e um teste.

### 11. Mensagem do 413 sempre fala de "arquivo de 5 MB"
`api/src/app.ts:35`

- **Problema:** um JSON acima de 100 kB (o limite padrão do `express.json`) também cai aqui e recebe "O arquivo é grande demais. O limite é de 5 MB."
- **Sugestão:** usar `erro.limit` na frase, ou tratar o caso só na rota da planilha.

### 12. Planilha `.xlsx` recebe nove erros de "Falta a coluna"
`api/src/dominio/planilha.ts:60-69`

- **Problema:** um `.xlsx` (que começa com os bytes `PK`) é lido como Windows-1252 e falha no cabeçalho, com 9 mensagens.
- **Por que importa:** é o erro mais provável de uma usuária não técnica.
- **Sugestão:** se os bytes começarem com `PK\x03\x04`, uma frase só: "Este arquivo é do Excel (.xlsx). No Excel, use Salvar como → CSV UTF-8 (separado por vírgulas)."

### 13. Data sem faixa de ano
`api/src/dominio/planilha.ts:220`

- `01/01/0001` é aceita, e `01/09/0226` (um "2" no lugar errado) também passaria. Recusar anos fora de uma faixa (por exemplo, 2000 a 2100), com a frase de sempre, é barato. Como o site é a verdade e "data diferente não gera item" (D19), o dano é pequeno; é mais higiene do que risco.

### 14. Front deduz a regra D24 por aproximação
`web/src/dominio/link-do-time.ts:28-30`

- **Problema:** a tela recalcula `prêmio × percentual / 100` e compara com o valor do time (aceitando +1 centavo) para descobrir se houve D24.
- **Por que importa:** é regra de negócio duplicada no front, contra o seu próprio princípio de "nada recalculado na tela". Hoje funciona, mas qualquer mudança no cálculo quebra a frase sem nenhum teste da API perceber.
- **Sugestão:** a API manda `comoFoiCalculado.valorDaPosicaoCentavos` e `recebeuParteDePosicoesSemTime: boolean`, gravados no cálculo.

### 15. Código morto ou que engana
- `api/src/servicos/calculo.ts:77` `calcularEGravar`: exportada do serviço, **sem trava e sem conferir se pode calcular**, usada só pelos testes. Alguém pode chamá-la de uma rota no futuro. Mover para um helper de teste ou fazer chamar `calcularTorneio`.
- `api/src/banco/migrations/002_completa_torneios.ts:9`: o status do torneio tem `conferindo` e `pronto`, que nunca são gravados. Na partida, `status_conferencia = 'times_diferentes'` também nunca é gravado (sai da comparação). Ou usar, ou dizer no DECISIONS que ficaram do rascunho.
- `api/src/dominio/dinheiro.ts`: `formatarCentavos` da API não é usada por nenhum código de produção (só o teste da etapa 0). O DECISIONS justifica "repetido no web" como se as duas fossem usadas.

### 16. Simulador sem falha aleatória
`site-oficial-simulado/src/app.ts:114-119`

- O enunciado diz "às vezes fora do ar ou sem resposta". O simulador só falha quando programado (`falhas_antes_de_responder`) ou pelo botão da demo. Um `SITE_TAXA_DE_FALHA=0.1` opcional (503 ou pendurar ao acaso) deixaria a demonstração mais fiel e testaria as novas tentativas sem script.

### 17. Documentação desatualizada em pontos pequenos
- `contexto.md:306`: "Ainda não incluído: os dados de setembro..." Já estão em `api/test/fixtures/site-setembro.json`, montado no simulador.
- `docker-compose.yml`: o MySQL fica exposto em `3307` com senhas padrão. Normal para demonstração; vale uma linha no README dizendo que é só para rodar localmente.

### 18. Detalhes de servidor
- `express` envia `X-Powered-By`. `app.disable('x-powered-by')` é uma linha; `helmet` seria exagero aqui.

---

## 🟢 Pontos positivos (o que defender na entrevista)

- **Maior resto em BigInt** (`api/src/dominio/divisao.ts:61-84`), com o resto inteiro no lugar da fração, e **teste de propriedade com 2 000 rodadas aleatórias** (`api/test/dominio/divisao.test.ts:113`): a soma fecha e ninguém fica a 1 centavo ou mais do exato. Poucos júniores fazem isso.
- **Uma regra só de arredondamento** para posições, empates e jogadores, e o caso Tuca × Corvinho como argumento: é uma ótima história para contar.
- **Conferência:** reserva curta com `FOR UPDATE SKIP LOCKED`, consulta **fora** da transação, recibo `DATETIME(3)` (com o teste que mostrou o problema), ordem de travas torneio → partidas → participações (com o deadlock que motivou), partida presa sem contar tentativa, erro de uma partida que não derruba o lote, job que sobrevive ao banco fora do ar. Tudo testado contra MySQL real.
- **Cálculo** que trava o torneio primeiro e **confere de novo dentro da transação** (`api/src/servicos/calculo.ts:49-73`), sem confiar na tela. Resultado **congelado** em tabelas próprias.
- **Cliente do site:** tempo limite cobrindo o corpo inteiro, só o 404 não é tentado de novo, resposta validada com Zod, cronômetro injetado para testar sem esperar.
- **Configuração validada na subida**, inclusive as relações entre valores (tempo limite > demora máxima; partida presa > tempo limite). Isso é de nível pleno.
- **Leitura da planilha:** BOM, CRLF/LF, `;`/`,`, Windows-1252, cabeçalho tolerante, colunas a mais, todos os erros juntados com a linha do Excel, D23 recusando partida com um time só.
- **Texto digitado com collation `utf8mb4_0900_as_cs`** e **códigos em `utf8mb4_bin`**: o banco nunca junta "xxsniperxx" com "xXSniperXx" em silêncio. Detalhe que poucos lembram.
- **Códigos de acesso** de 192 bits do gerador criptográfico, 404 igual para qualquer erro, `X-Robots-Tag: noindex`, e a página pública **copia campo a campo** para um campo novo não vazar.
- **CSV para o Excel brasileiro:** BOM, `;`, CRLF, valor sem ponto de milhar para somar, `filename*` (RFC 6266), coluna "Pago".
- **Camadas respeitadas:** rotas finas, serviços orquestrando, domínio puro. Resultados como uniões discriminadas (`{ tipo: ... }`) com `switch` exaustivo nas rotas.
- **Front:** `label` em todo campo, `aria-live` no resumo do filtro, `caption` nas tabelas, `role="alert"`, `prefers-reduced-motion`, layout para 640 px, estados de carregando, erro e vazio em todas as páginas, sondagem com `setTimeout` encadeado que para sozinha.
- **Gabaritos** de `testes/esperado/` conferidos centavo por centavo nos testes de integração.

---

## Os dois itens que você já conhecia

### Dois relógios (importação com o do MySQL; job e correção de ID com o do Node)

**Minha opinião:** o DECISIONS diz que "no Docker os dois são o mesmo relógio, então não há problema em produção". Sobre o **desvio** do relógio, concordo. Mas o risco maior é o **fuso horário**, e esse não está documentado:

- `timezone: 'Z'` no mysql2 (`conexao.ts:44`) só diz como **converter** `Date` do JavaScript. Ele **não** muda o fuso da sessão do MySQL.
- `NOW()` e `CURRENT_TIMESTAMP` (o padrão de `proxima_tentativa_em`, `planilha_importada_em` e `created_at`) usam o fuso da sessão. No contêiner `mysql:8.4` é UTC (conferi: `@@time_zone = SYSTEM`, sistema `UTC`), então hoje funciona.
- Num MySQL gerenciado ou local configurado para `-03:00`, esses horários seriam gravados 3 h atrás do que o Node escreve. As partidas sairiam "atrasadas" (o job pegaria na hora, sem dano). Mas a data de criação, que define o **mês do torneio** sem planilha (M1), ficaria errada perto da virada do mês, e "importada às X" mostraria a hora errada. Num fuso **à frente** do UTC, as partidas recém-importadas esperariam horas para ser consultadas.

**Sugestão (30 min, vale fazer antes de entregar):**
1. Fixar o fuso da sessão no pool, uma linha que elimina o problema do fuso:
   ```ts
   pool: { min: 0, max: 10, afterCreate: (conn: any, done: any) => conn.query("SET time_zone = '+00:00'", (e: unknown) => done(e, conn)) },
   ```
2. Importação grava `proxima_tentativa_em: emSegundosInteiros(agora)` com o relógio injetado (como o job e a correção já fazem), e `importarPlanilha` passa a receber `agora`. Um relógio só no código, mais fácil de explicar, e os testes deixam de precisar do `relogioDoBanco` para esse caso.

Se não der tempo, deixe no DECISIONS a frase sobre o **fuso**, não só sobre o desvio.

### Espaço comum entre "R$" e o número

**Minha opinião:** vale corrigir, é barato. Em tabela estreita no celular, "R$" pode ficar no fim de uma linha e "1.000,00" na seguinte. O `Intl.NumberFormat('pt-BR', { style: 'currency' })` usa espaço não separável (U+00A0) justamente por isso.

**Sugestão:** em `web/src/dominio/dinheiro.ts:49`, trocar `R$ ` por `R$ `. Os testes que comparam com `'R$ 1.000,00'` vão quebrar: atualize-os com ` `, ou compare normalizando os espaços. Para leitor de tela e para copiar e colar, não muda nada. Alternativa só de CSS (`white-space: nowrap` nas células de valor) resolve a tabela, mas não as frases do link do time, então prefiro o U+00A0. O CSV não usa esse formatador e não precisa mudar.

---

## Requisitos do enunciado

| Requisito | Situação |
|---|---|
| Subir o CSV | ✅ Com erros por linha e conversão de Windows-1252 |
| Conferir cada partida no site, lento e instável | ✅ Em segundo plano, com novas tentativas e "tentar agora" |
| "Se alguma coisa não bater, quero saber o quê" | ✅ Pendências lado a lado, um item por problema |
| Prêmio de cada jogador | ✅ Tela do resultado, CSV e link do time |
| Filtro por nick | ✅ No resultado e no link do time (sem acento e maiúsculas) |
| Backend + frontend + banco conectados | ✅ Um `docker compose up --build` |
| README (como rodar, por que essa stack) | ⚠️ Como rodar sim; "por que essa stack" falta (item 5) |
| DECISIONS (decisões, alternativas, o que ficou de fora) | ⚠️ Tudo existe, mas longo demais e sem resumo (item 6) |

---

## Decisões: são defensáveis? O que vão perguntar

| Decisão | Defensável? | Trade-off | O que um avaliador perguntaria |
|---|---|---|---|
| **Site como fonte da verdade, a Maria só dá "Ciente"** (D3, D4, D16) | Sim, é a melhor do projeto | Se o site errar, não há como corrigir à mão | "E se o site oficial estiver errado e um jogador provar?" Tenha a resposta: hoje não há saída; uma evolução seria um ajuste manual **auditado** (quem, quando, por quê), separado do dado do site |
| **Minutos ou kills configurável, travado no cálculo** (D1) | Sim | Você implementou o "kills" mesmo argumentando contra (Dona.Tank). Boa postura de produto | "Por que implementar o que você acha ruim?" Resposta: a decisão é dela; o sistema mostra a consequência (aviso na criação, D21) |
| **Desempate por kills, depois divisão igual** (D2) | Sim | Kills favorece times agressivos; confronto direto foi descartado pelo ciclo | "Quem decidiu? A Maria concordaria?" Diga que é proposta sua, visível na página pública, e que confirmaria com ela |
| **Maior resto em tudo** (D9, D20) | Sim, muito bem argumentada | Um pouco mais difícil de explicar que "centavo para quem jogou mais" | "Explique com o Tuca." Tenha o exemplo de cabeça |
| **Tabela de tarefas no MySQL em vez de fila** | Sim para 15 a 28 partidas | Polling a cada 5 s; uma API só | "E com 1 000 torneios?" Fale do pool (item 9), de separar o worker (já está atrás de `iniciarJob`) e do índice `partidas_fila_conferencia` |
| **Job no mesmo processo da API** | Sim para o tamanho | Um deploy derruba os dois | "Como escalar?" Várias APIs funcionam por causa do SKIP LOCKED: diga que foi testado |
| **Sem login** | Sim como corte de prazo | O furo do item 1 | **Vão perguntar.** Corrija o texto ou ponha a senha única antes |
| **Pendências calculadas na hora, só os Cientes gravados** | Sim, elegante | O `GET /torneios/:id` refaz a comparação a cada 5 s | "Isso escala?" Para centenas de linhas, sim; com cache ou gravação das pendências, se crescer |
| **Upload como `PUT` com o arquivo no corpo** | Sim | Fora do padrão multipart | "Por que não multipart?" Você já tem a resposta no DECISIONS |
| **Front servido pelo `vite preview`** | Ok para demonstração | Não é servidor de produção | "Como seria o deploy?" nginx servindo o `dist` e fazendo proxy de `/api`, ou a API servindo os estáticos |
| **CLAUDE.md e o uso de IA no repositório** | Ok (IA liberada) | Mostra o processo | "Quanto foi você e quanto foi a IA?" Prepare uma resposta honesta: as regras e os cortes foram decisões suas, e você explica qualquer linha |

---

## Corrija antes de entregar (cabe em algumas horas)

1. **Item 1:** corrigir o texto da limitação no DECISIONS (15 min) **ou** a senha única de administradora (1 a 2 h).
2. **Item 2:** limites de tamanho e de valor na leitura da planilha e na correção do ID, com testes (~1 h).
3. **Item 3:** `superRefine` na resposta do site (vencedor e times dos jogadores ∈ `times`, `id` igual ao consultado), com teste (~30 min).
4. **Item 7:** apagar `tatus` (1 min).
5. **Relógio:** `SET time_zone = '+00:00'` no pool (10 min); a importação com o relógio do Node, se sobrar tempo (~30 min).
6. **R$ com U+00A0** e testes atualizados (~20 min).
7. **Item 10:** `\t` e `\r` na proteção do CSV (5 min).
8. **Itens 5 e 6 (etapa 8):** README com demonstração em 5 passos e "Por que essa stack"; resumo de uma página no topo do DECISIONS, com "o que ficou de fora" e as limitações.
9. **Item 15:** tirar `calcularEGravar` do serviço (ou fazê-la chamar `calcularTorneio`) (10 min).

## Mencione como melhoria futura

- Login de verdade para a Maria (sessão, recuperação de acesso), além da senha única.
- Pool de consultas no lugar do lote com `Promise.all` (item 9).
- Falha aleatória configurável no simulador (item 16).
- Frase específica para `.xlsx` (item 12) e faixa de ano na data (item 13).
- A API mandar os dados da D24 em vez de o front deduzir (item 14).
- `ErroDeRegra` com 409 no cálculo (item 4), se não entrar agora.
- Ajuste manual auditado para quando o site oficial estiver errado.
- Deploy com nginx (estáticos + proxy), HTTPS e só `/publico` e `/time` expostos.
- Limpar os status que nunca são gravados (`conferindo`, `pronto`, `times_diferentes`).
- Teste de tempo de parede (`conferencia.test.ts:271`) com folga maior ou medido por contagem de travas, para CI.
