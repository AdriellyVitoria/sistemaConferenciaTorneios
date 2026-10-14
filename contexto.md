# Contexto: sistema de premiação de torneios da Maria Clara

> Este arquivo descreve **o quê** precisa ser resolvido e **por quê**. Não descreve como codificar.
> Ele é a fonte de verdade das regras de negócio. Toda decisão tomada aqui vai também para o `DECISIONS.md`.

---

## 1. O desafio

Etapa de trabalho de casa do processo seletivo da PowerRev (Desenvolvedora Full Stack Júnior).

- **O que avaliam:** como eu penso, o que priorizo e por quê. Não existe resposta certa.
- **Preferem** algo menor e bem pensado a algo grande e apressado.
- **Requisitos técnicos:** backend, frontend e banco de dados, conectados e funcionando. Stack livre. Vão olhar a estrutura do projeto e boas práticas. IA liberada.
- **Entregar:** repositório git + `README.md` (como rodar e por que essa stack) + `DECISIONS.md` (decisões, alternativas descartadas e, principalmente, **o que decidi não fazer por falta de tempo e por quê**). O `DECISIONS.md` importa tanto quanto o código.
- **Prazo:** 7 dias corridos a partir do recebimento do e-mail.
- **Depois:** sessão de cerca de 1 hora para apresentar e discutir as decisões.
- **Dica deles:** o contexto não é energia de propósito, mas tem mais a ver com o dia a dia da PowerRev do que parece.

---

## 2. A usuária e a dor real

**Maria Clara** organiza torneios amadores de um jogo de tiro 5 contra 5. Cada torneio tem 6 times, todos contra todos, ao longo de algumas semanas. No fim, distribui um prêmio em dinheiro entre os jogadores.

**Como é hoje:**
1. Anota cada partida à mão numa planilha, depois que ela termina.
2. Confere cada partida no site oficial do jogo, uma por vez. É lento e às vezes o site não responde. Perde uma tarde por torneio, e o próximo terá mais times.
3. Calcula os prêmios no Excel.
4. Faz os Pix um por um.
5. O Discord enche de jogadores perguntando **"por que eu recebi só isso?"**.

**Leitura das dores (a confirmar nas decisões):**

| Dor | O que está por trás |
|---|---|
| Conferência manual no site | Tempo perdido e risco de erro humano; não escala com mais times |
| "Por que eu recebi só isso?" | Falta de **transparência**: o jogador não vê como o valor dele foi calculado |
| Planilha feita à mão | Erros de digitação passam direto para o dinheiro |

O pedido literal dela: *"subir a planilha e o sistema conferir tudo sozinho no site oficial. Se alguma coisa não bater, quero saber o quê."*

---

## 3. Glossário

| Termo | Significado |
|---|---|
| Torneio | Conjunto de partidas com um prêmio total. Este: setembro/2026, R$ 10.000,00 |
| Time | Grupo de jogadores. São 6: Lobos, Serpentes, Corvos, Panteras, Tubarões, Falcões |
| Jogador | Identificado pelo **nick** |
| Partida | Um jogo entre dois times, identificado pelo **ID da partida** do próprio jogo |
| Rodada | Agrupamento de partidas (1 a 5). Com 6 times em todos contra todos, são 5 rodadas de 3 partidas = 15 partidas |
| Colocação | Posição final do time, pelo número de vitórias |
| Conferência | Comparar o que está na planilha com o que o site oficial registra |
| Divergência | Diferença entre planilha e site oficial |

---

## 4. Regras de negócio dadas pela Maria Clara

1. **Prêmio total:** R$ 10.000,00.
2. **Divisão entre times, pela colocação:**
   - 1º lugar: 50% = R$ 5.000,00
   - 2º lugar: 30% = R$ 3.000,00
   - 3º lugar: 20% = R$ 2.000,00
   - 4º ao 6º: nada
3. **Colocação:** pelo número de vitórias.
4. **Divisão dentro do time:** proporcional aos **minutos jogados** por cada jogador, somando todas as partidas.
5. **Proposta de mudança:** dividir pelas **kills** em vez dos minutos ("quem joga bem merece mais").

---

## 5. A planilha `torneio-setembro.csv`

**Formato técnico (exportação do Excel brasileiro):**
- Separador `;` (não vírgula)
- Codificação UTF-8 **com BOM** (marca invisível que o Excel coloca no início do arquivo) e quebra de linha do Windows (CRLF)
- Acentos nos nomes (Tubarões, Falcões, Víbora, Tchê)
- Data no formato `dd/mm/aaaa`
- ID da partida com `#` na frente (`#45659`)
- `Venceu?` com os valores `sim`, `não` ou vazio
- Uma linha por **jogador por partida** (152 linhas de dados)
- A coluna `Partida` ("Lobos x Serpentes") repete informação que já existe nas linhas

| Coluna | O que é |
|---|---|
| Data | Dia da partida |
| Rodada | Rodada do torneio (1 a 5) |
| ID Partida | Código da partida, copiado do próprio jogo |
| Partida | Quem jogou contra quem |
| Time / Nick | Time e apelido do jogador |
| Minutos | Quanto tempo o jogador ficou na partida |
| Kills | Abates do jogador na partida |
| Venceu? | Se o time do jogador venceu a partida |

**O que está correto:** as 15 partidas do todos contra todos estão presentes, cada par de times se enfrenta uma vez, e nenhum jogador aparece em dois times.

---

## 6. Problemas encontrados na planilha

| # | Onde | O que acontece | Por que importa |
|---|---|---|---|
| P1 | Partida `#46065`, rodada 2 | **Pantera_X aparece duas vezes**, com os mesmos dados. Panteras fica com 6 jogadores | Se não for tratado, Pantera_X ganha 42 minutos a mais e recebe mais do que deveria |
| P2 | Partida `#48087`, rodada 3 | Nick **`xxsniperxx`** em minúsculas. Nas outras partidas é **`xXSniperXx`** | Se não for tratado, vira dois jogadores diferentes e o prêmio é dividido errado |
| P3 | Partida `#46903`, rodada 2 | Corvos tem 6 jogadores: **Bia.gg jogou 18 min e Tuca 19 min**, somando os 37 min da partida. Tuca só aparece nessa partida | Parece uma **substituição**. Tuca é reserva e tem direito a uma parte? |
| P4 | Partida `#40923`, rodada 5 (Falcões x Panteras) | **Todos com 0 minutos, 0 kills e `Venceu?` vazio** | Partida não registrada, não jogada ou W.O.? **O resultado dela muda a classificação** (ver seção 7) |
| P5 | Todo o arquivo | Kills nunca foram conferidos contra o site | Se a regra passar a ser por kills, qualquer erro de digitação vira dinheiro |

---

## 7. Classificação pela planilha e o empate

Vitórias contadas pela planilha (sem a partida `#40923`):

| Time | Vitórias |
|---|---|
| Lobos | 5 |
| Corvos | 3 |
| Tubarões | 3 |
| Falcões | 2 (+1 se venceu a `#40923`) |
| Panteras | 1 (+1 se venceu a `#40923`) |
| Serpentes | 0 |

**Lobos é campeão.** O problema está no 2º e 3º lugar:

- **Corvos e Tubarões empatam com 3 vitórias.** A diferença entre 2º e 3º é de **R$ 1.000,00** para o time.
- **Se Falcões venceu a partida `#40923`, são três times empatados com 3 vitórias.**
- No confronto direto entre os três, há um **ciclo**: Corvos venceu Tubarões (R2), Tubarões venceu Falcões (R1) e Falcões venceu Corvos (R4). O confronto direto sozinho não desempata.

**Conclusão:** antes de pagar, é preciso saber o resultado da `#40923` (o site oficial pode responder) e ter uma regra de desempate.

---

## 8. Exemplos de cálculo (para entender o impacto das regras)

**Lobos (1º lugar, R$ 5.000,00), por minutos:** os 5 jogaram 211 minutos cada, então cada um recebe **R$ 1.000,00**. Isso só vale se `xXSniperXx` e `xxsniperxx` forem tratados como o mesmo jogador.

**Lobos, se fosse por kills:**

| Jogador | Kills | Por minutos | Por kills |
|---|---|---|---|
| xXSniperXx | 89 | R$ 1.000,00 | R$ 1.260,62 |
| Lua_ | 88 | R$ 1.000,00 | R$ 1.246,46 |
| Pipoca | 67 | R$ 1.000,00 | R$ 949,01 |
| R4mbo | 59 | R$ 1.000,00 | R$ 835,69 |
| Dona.Tank | 50 | R$ 1.000,00 | R$ 708,22 |

Repare no nome **Dona.Tank**: em jogos de equipe, o "tank" protege o time e naturalmente faz menos kills. Dividir por kills pune quem joga para o time ganhar, e incentiva jogar para a estatística.

**Corvos, se ficar em 2º (R$ 3.000,00), por minutos:** total de 865 minutos no time. Corvinho, M4theus, Zeca e Nina.exe recebem R$ 600,00 cada; Bia.gg recebe R$ 534,10; Tuca, R$ 65,90.

**Arredondamento:** a divisão proporcional quase nunca dá centavos exatos. A soma paga precisa fechar exatamente no prêmio, sem sobrar nem faltar centavo.

---

## 9. O site oficial (a ser simulado)

O que se sabe:
- Consulta **pelo ID da partida**, uma partida por vez.
- Cada consulta leva de **2 a 10 segundos**.
- **De vez em quando fica fora do ar ou não responde.**

Consequências:
- 15 partidas, uma por vez, podem levar até 2 minutos e meio. Com mais times, muito mais.
- A conferência não pode travar a tela da Maria Clara nem se perder se o site cair no meio.
- Precisa existir um estado para partida **não conferida** (site fora do ar), diferente de **conferida com divergência**.
- Como não há acesso ao site real, eu decido o formato da resposta simulada, e posso usá-la para criar divergências de teste (incluindo o resultado da `#40923`).

**Papéis de cada fonte:** a planilha diz **quais** partidas fazem parte do torneio (o site não sabe disso, só responde por ID). O site diz **o que aconteceu** em cada partida e é a fonte da verdade para tudo: vencedor, jogadores, minutos e kills.

**O que o site simulado devolve:**

| Situação | Resposta |
|---|---|
| Partida encontrada | ID, data, os dois times, o vencedor e, para cada jogador: nick, time, minutos e kills |
| Partida não existe | "Não encontrada" (ex.: ID digitado errado na planilha) |
| Site fora do ar | Erro ou tempo esgotado. A partida fica "não conferida" e entra nas tentativas |
| Comportamento normal | Demora de 2 a 10 segundos por consulta |

**Erros que o site simulado terá para a demonstração:** _a definir_ (sugestão: kills diferentes para algum jogador e um resultado para a `#40923`).

---

## 10. O que precisa existir no mínimo

1. Subir a planilha e ter as partidas conferidas no site oficial.
2. Ver de forma fácil quanto cada jogador recebe e, se possível, filtrar pelo nick.

Além disso, eu decido o que construir, o que deixar de fora e como apresentar.

---

## 11. Decisões de regra de negócio

> Cada decisão vai também para o `DECISIONS.md`, com as alternativas descartadas.
> "A confirmar" = proposta ainda não validada.

| # | Tema | Decisão | Por quê |
|---|---|---|---|
| D1 | Minutos ou kills | **Configurável por torneio.** A Maria Clara escolhe a forma de divisão **antes** de subir a planilha. Depois do cálculo, **não pode mais mudar** | Mudar depois de ver o resultado permitiria favorecer ou prejudicar jogadores. A regra precisa ser conhecida antes |
| D2 | Desempate na colocação | 1º critério: **total de kills do time no torneio**. Se empatar também em kills: **somam-se os prêmios das posições empatadas e divide-se igual** entre os times. O empate e o critério usado ficam **visíveis no sistema**, como justificativa do valor | Kills sempre desempata o caso atual (o confronto direto forma um ciclo). A divisão igual é o último recurso justo. Mostrar o critério evita a pergunta "por que recebi isso?" |
| D3 | Fonte da verdade | **Site oficial** para tudo: vencedor, jogadores, minutos e kills. A planilha define quais partidas e times fazem parte do torneio | O site é o registro oficial do jogo; a planilha é digitada à mão |
| D4 | Divergência entre planilha e site | **Bloqueia o cálculo** até a Maria Clara revisar. A divergência fica **destacada em cor**, com o valor da planilha e o do site **lado a lado** | Dinheiro pago errado é difícil de recuperar. Ver os dois números juntos deixa a diferença óbvia |
| D5 | Partida sem resultado (`#40923`) | Primeiro, busca no site. Se o site também não tiver, **a Maria Clara informa o que aconteceu** (ex.: vitória de um dos times, W.O., partida não realizada). O pódio fica bloqueado até isso | Esse resultado muda o pódio. O sistema não deve adivinhar |
| D6 | Linha duplicada (Pantera_X) | Fica **destacada em amarelo** como possível duplicata. A Maria Clara pode **editar ou remover**. Enquanto não decidir, fica pendente e **bloqueia o cálculo** | Remover sozinho poderia apagar um dado real; ignorar daria minutos a mais |
| D7 | Nick com maiúsculas diferentes (`xXSniperXx` / `xxsniperxx`) | O sistema **pergunta à Maria Clara se é a mesma pessoa**. Se sim, une os dois | Ela conhece os jogadores; o sistema só aponta a suspeita |
| D8 | Substituição (Tuca) | **Reserva recebe como qualquer jogador**, proporcional aos minutos (ou às kills, se esse for o modo do torneio) | A regra já é proporcional à participação; quem jogou, recebe |
| D9 | Centavos que sobram | Divide em centavos. O centavo que sobra vai, um por vez, para **quem tem mais minutos ou mais kills**, conforme o modo do torneio (D1). Empate nesse critério: **ordem alfabética do nick**. O extrato do jogador **mostra que recebeu R$ 0,01 de arredondamento e por qual critério** | A soma precisa fechar exatamente no prêmio, a regra precisa dar sempre o mesmo resultado e ser explicável |
| D10 | Site fora do ar | **Tenta até conseguir, com intervalo crescente**: 1 min, 2 min, 5 min e depois a cada 10 min (*backoff*). A conferência roda em segundo plano, e a tela mostra **"última tentativa às X, próxima às Y"**. Botão **"tentar agora"** com espera de alguns minutos entre cliques; ele **não cria uma consulta paralela**, só antecipa a próxima tentativa do mesmo processo (partida com status "em consulta" ou "conferida" é ignorada). Enquanto isso, a Maria Clara resolve as **pendências locais** (duplicatas, nicks parecidos). Intervalos **configuráveis**, curtos no modo demonstração, que tem botões para derrubar e religar o site simulado | Não obriga a Maria a vigiar o site. O intervalo crescente não sobrecarrega um site que já está com problema. O controle por status evita duas consultas da mesma partida ao mesmo tempo, o mesmo tipo de problema de concorrência que já resolvi no trabalho |
| D11 | "Por que eu recebi só isso?" | **Duas camadas.** Página **pública** do torneio: classificação, regras, critério de desempate e prêmio por time, sem valores individuais. **Link por time premiado** (com token): o extrato de cada jogador do time, com minutos ou kills, a conta e o centavo de arredondamento, e filtro por nick. A Maria Clara envia **um link para cada time premiado** (normalmente 3; pode ser mais em caso de empate com divisão do prêmio). Times sem prêmio veem só a página pública | Resolve a raiz: o jogador vê a própria conta e a dos colegas sem precisar perguntar. Colegas de time já conhecem os minutos uns dos outros; nenhum valor individual fica exposto para outros times |
| D12 | Pagamento e mensagens | **Fora do escopo:** Pix automático, envio de comprovante e bot do Discord. Ficam como evolução no `DECISIONS.md` | Dinheiro enviado errado não volta; exigiria chave Pix e usuário do Discord de cada jogador; o desafio pede algo menor e bem pensado |
| D13 | Jogador em dois times diferentes | Recebe **como um reserva, pelos minutos, em cada time em que jogou**: os minutos por um time contam na parte daquele time. O sistema mostra um **aviso informativo**, sem bloquear o cálculo | O site confirma que aconteceu de verdade; a regra proporcional já trata a participação em cada time |
| D14 | Separador do arquivo | O sistema **aceita `;` e `,`**, detectando o separador pela primeira linha. As colunas continuam sendo validadas | Exportações de Excel em inglês ou do Google Planilhas usam vírgula. A Maria Clara não é técnica e não deveria precisar reexportar |
| D15 | Site simulado para setembro | O site repete a planilha, sem a linha duplicada e com o nick `xXSniperXx` correto. Para a partida `#40923` (Falcões x Panteras), o site registra **vitória de Falcões**. Nenhuma outra divergência | Cria o caso mais rico para a demonstração: empate triplo com 3 vitórias (Corvos, Tubarões, Falcões), resolvido por kills, que pode tirar Tubarões do pódio |

---

## 12. Fluxo da Maria Clara (resultado das decisões)

1. Cria o torneio: nome, prêmio, percentuais e **forma de divisão** (minutos ou kills, travada depois do cálculo).
2. Sobe a planilha.
3. O sistema valida o arquivo e aponta as **pendências locais**: duplicatas (amarelo) e nicks parecidos (pergunta se é a mesma pessoa).
4. Em segundo plano, confere cada partida no site oficial (3 tentativas a cada 30 minutos se estiver fora do ar).
5. Mostra as **divergências** lado a lado (planilha × site) e as partidas sem resultado, para ela decidir.
6. Sem pendências, calcula: classificação, desempate (com justificativa), prêmio por time e por jogador, centavos fechando no total.
7. Gera a **página pública** com o extrato de cada jogador e filtro por nick.

## 13. Ligação com a PowerRev (para a apresentação)

| Maria Clara | PowerRev |
|---|---|
| Conferir partida no site oficial, lento e instável | Conferir fatura na distribuidora |
| Dividir o prêmio do time pelos minutos | Ratear créditos de energia entre unidades consumidoras |
| Centavos que precisam fechar | Precisão numérica em cobrança |
| "Por que eu recebi só isso?" | Cliente questionando o valor cobrado |
| "Quero dividir por kills" | Pedido do cliente que pode não resolver o problema dele |

---

## 14. Casos de teste

Todos os arquivos ficam em `testes/` e são gerados por `testes/gerar_cenarios.py` (sempre os mesmos dados).

- `testes/planilhas/`: planilhas no mesmo formato da Maria Clara (UTF-8 com BOM, separador `;`, CRLF).
- `testes/site-oficial.json`: o que o site oficial simulado devolve para cada ID de partida. É a "verdade" do simulador.
- `testes/esperado/`: classificação e prêmio por jogador esperados, para comparar com o resultado do sistema.

**Premissas dos resultados esperados:** prêmio de R$ 10.000,00 (50/30/20), divisão por **minutos**, desempate por kills do time, empate também em kills divide igual, centavo que sobra para quem tem mais minutos e depois ordem alfabética.

| Cenário | Arquivo | O que tem | O que o sistema deve fazer |
|---|---|---|---|
| 01 | `01-limpa.csv` | 6 times, 15 partidas, sem erros. Dois jogadores saíram mais cedo (Escama na rodada 2, Cinzas na rodada 4) | Conferir tudo sem divergência e calcular. Dragões 1º (R$ 5.000), Fênix 2º (R$ 3.000), Leões 3º (R$ 2.000). Dentro dos Dragões, Brasa.gg recebe R$ 1.029,77 e Fogaréu R$ 1.029,76: o centavo foi para Brasa.gg pela ordem alfabética (mesmos minutos). Valores por jogador em `esperado/01-limpa-jogadores.csv` |
| 02 | `02-id-inexistente.csv` | A partida `#52241` foi digitada como `#52214` (dígitos invertidos) | O site responde "não encontrada" para `#52214`. Mostrar a partida como pendente e **bloquear o cálculo** (D4) |
| 03 | `03-divergencias.csv` | Três diferenças entre planilha e site: Juba (`#53132`) kills 18 × 8; Plumada (`#53428`) minutos 15 × 27; Harpia (`#53718`) kills 9 × 13 | Listar as 3 divergências **lado a lado** (planilha × site), **bloquear o cálculo** até a revisão e calcular com os valores do site (D3, D4) |
| 04 | `04-empate-em-kills.csv` | Fênix e Leões com 3 vitórias e **398 kills cada**. Fênix venceu Leões no confronto direto, mas esse critério não é usado | Dividir 30% + 20% igualmente: **R$ 2.500 para cada time**, com a justificativa visível. Lobos-Guará e Ursos também empatam em vitórias (4º e 5º), mas sem prêmio |
| 05 | `05-oito-times.csv` | 8 times, 7 rodadas, 28 partidas, sem erros | Conferir 28 partidas sem travar a tela. Dragões 1º, Fênix 2º, Leões 3º |
| 06a | `06a-coluna-faltando.csv` | Sem a coluna `Kills` | **Recusar o arquivo** com mensagem clara dizendo qual coluna falta |
| 06b | `06b-separador-virgula.csv` | Separador `,` em vez de `;` | Detectar o separador e importar normalmente (D14) |
| 07 | `07-jogador-em-dois-times.csv` | Na rodada 4, **Garra** joga pelos Leões e também pelos Ursos (no lugar de Pardo). O site confirma: não é erro de digitação | Aviso informativo, sem bloquear. Garra recebe pelos minutos em cada time (D13) |
| Extra | `torneio-outubro.csv` | Torneio normal. Na rodada 3, Bico (Águias) sai aos 15 minutos e entra o reserva **Sabiá** | Calcular normalmente; Sabiá recebe pelos minutos (D8). Leões 1º, Águias 2º, Dragões 3º |
| Extra | `torneio-novembro.csv` | Os mesmos problemas de digitação de setembro: `mel.zinho` em minúsculas na rodada 2 e **Rapina duplicado** na rodada 4. Além disso, **duas partidas instáveis no site**: `#62142` falha 2 vezes antes de responder e `#62477` falha 5 vezes | Pendências locais: perguntar se `mel.zinho` é Mel.zinho (D7) e destacar a duplicata (D6). Tentar de novo as partidas instáveis até responderem (D10) |

**A planilha original da empresa (`torneio-setembro.csv`) fica congelada até o fim do projeto:** ela é usada exatamente como foi enviada, para testar a solução. As planilhas de `testes/` podem ser ajustadas ou ampliadas depois da entrega.

**Ainda não incluído:** os dados de setembro no site simulado (decisão D15). Entram quando o simulador for construído, sem alterar a planilha original.


---

## 15. Foco da entrega

Primeiro, entregar **o que o desafio pede**: subir a planilha, conferir no site, calcular e mostrar quanto cada jogador recebe, com filtro por nick, mais `README.md` e `DECISIONS.md`.

**Depois da entrega (extras):**
- Mais cenários de teste
- Pix automático e envio de comprovante
- Bot do Discord


---

## 16. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Backend | **Node.js com TypeScript** | Faz parte da stack da PowerRev; tipagem ajuda a modelar as regras de negócio com segurança |
| Frontend | **Vue** | É o framework com que tenho mais afinidade, e também faz parte da stack da PowerRev |
| Banco de dados | **MySQL** | Faz parte da stack da PowerRev; `JOIN`, `GROUP BY`, índices e transações funcionam como no PostgreSQL que já uso |
| Processamento em segundo plano | **Tabela de tarefas no MySQL**, com um job que busca as partidas pendentes cuja próxima tentativa já chegou | Mesmo padrão da janela de envio que construí no trabalho: status, tentativas e reserva com lock (`SELECT ... FOR UPDATE SKIP LOCKED`), para duas execuções não pegarem a mesma partida. Para 15 a 28 partidas por torneio, uma fila dedicada seria uma peça a mais sem ganho real |

**Alternativa descartada: fila no Redis (BullMQ).** Também está na stack da PowerRev e traz as novas tentativas prontas, mas exige mais um serviço e um processo separado. O worker fica isolado atrás de uma interface: se o volume crescer, dá para trocar por Redis ou SQS sem mudar a regra de negócio.
