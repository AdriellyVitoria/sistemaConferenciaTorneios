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

**Como fica (D2, D5, D15):** o site registra vitória de Falcões na `#40923`, com 62 kills. Corvos, Tubarões e Falcões empatam com 3 vitórias; pelas kills, Corvos fica em 2º (368) e Tubarões e Falcões empatam também em kills (310 cada), dividindo o prêmio do 3º lugar. O resultado completo está no caso de teste de setembro (seção 14).

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

**Corvos, se ficar em 2º (R$ 3.000,00), por minutos:** total de 865 minutos no time. Na conta exata, Corvinho, M4theus, Zeca e Nina.exe têm R$ 600,00 cada; Bia.gg, R$ 534,104; Tuca, R$ 65,895. Cortando nos centavos, sobra R$ 0,01. Pela D9 (maior resto), ele vai para quem perdeu mais no corte: Tuca (0,595 centavo) perdeu mais que Bia.gg (0,405). **Corvinho, M4theus, Zeca e Nina.exe recebem R$ 600,00; Bia.gg R$ 534,10; Tuca R$ 65,90.**

**Arredondamento:** a divisão proporcional quase nunca dá centavos exatos. A soma paga precisa fechar exatamente no prêmio, sem sobrar nem faltar centavo. A regra é a mesma no sistema todo (D9).

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
| Partida não existe | "Não encontrada": o ID foi digitado errado na planilha. A Maria corrige o ID na tela e o sistema consulta de novo só aquela partida (D5) |
| Partida de outros times | O ID existe, mas no site é um jogo entre outros times: o ID está errado. Bloqueia até a Maria corrigir o ID (D4) |
| Site fora do ar | Erro ou tempo esgotado. A partida fica "aguardando o site" e entra nas tentativas (D10) |
| Comportamento normal | Demora de 2 a 10 segundos por consulta |

**Dados de setembro no site simulado:** definidos na D15 (seção 11).

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
| D2 | Desempate na colocação | 1º critério: **total de kills do time no torneio**. Se empatar também em kills: **somam-se os prêmios das posições empatadas e divide-se igual** entre os times (centavos que sobram pela D9, com a ordem alfabética do nome do time). O empate e o critério usado ficam **visíveis no sistema**, como justificativa do valor | Kills sempre desempata o caso atual (o confronto direto forma um ciclo). A divisão igual é o último recurso justo. Mostrar o critério evita a pergunta "por que recebi isso?" |
| D3 | Fonte da verdade | **Site oficial** para tudo: vencedor, jogadores, minutos e kills, **inclusive para preencher o que falta**: se a planilha tem a partida zerada ou vazia e o site tem os dados, vale o site, sem bloquear. A planilha define quais partidas e times fazem parte do torneio | O site é o registro oficial do jogo; a planilha é digitada à mão |
| D4 | Divergência entre planilha e site | **Dois tipos.** (a) **Minutos, kills ou vencedor diferentes, ou jogador que está no site e não na planilha (ou o contrário):** o sistema usa o valor do site (e os jogadores do site) e mostra planilha × site **lado a lado**, destacado em cor. A Maria clica em **"Ciente"** (ou **"Ciente de todas"**); ela não escolhe valor. Depois do "Ciente", não bloqueia. (b) **Times diferentes** (o ID da planilha corresponde, no site, a uma partida de outros times): **bloqueia o cálculo**, porque o ID está errado. A Maria corrige o ID (D16) | Como o site é a verdade (D3), não há escolha a fazer nos valores; o "Ciente" garante que ela viu a diferença antes de pagar. Times diferentes significam que a partida certa nem foi consultada |
| D5 | Partida que não está no site | **Toda partida precisa existir no site oficial.** A Maria **nunca informa resultado à mão**. Site fora do ar: continua tentando (D10). Site responde "não encontrada": o ID foi digitado errado; a Maria **corrige o ID na tela** e o sistema consulta de novo só aquela partida (D16). Bloqueia o cálculo até a partida ser conferida | Um erro de digitação da Maria viraria Pix errado e perda de confiança dos jogadores. O resultado tem que vir do registro oficial |
| D6 | Linha duplicada (Pantera_X) | Vira **aviso com "Ciente"**, sem bloquear. Aparece como **um único item**, já com o lado a lado do site | O cálculo usa os dados do site, onde o jogador aparece uma vez só; a duplicata não muda o dinheiro |
| D7 | Nick com maiúsculas diferentes (`xXSniperXx` / `xxsniperxx`) | Vira **aviso com "Ciente"**, sem bloquear. Aparece como **um único item**, já com o lado a lado do site | O cálculo usa o nick registrado no site; a diferença de digitação não muda o dinheiro |
| D8 | Substituição (Tuca) | **Reserva recebe como qualquer jogador**, proporcional aos minutos (ou às kills, se esse for o modo do torneio) | A regra já é proporcional à participação; quem jogou, recebe |
| D9 | Centavos que sobram | **Método do maior resto, uma regra única no sistema todo** (entre as posições do pódio, D20; entre times empatados; e dentro do time). Cada um recebe a parte inteira em centavos do seu valor exato; os centavos que sobram vão, um por vez, para **quem tem a maior parte fracionária** (quem mais perdeu no corte). Empate na fração: **ordem alfabética** do nick (ou do nome do time, na divisão entre times), ignorando acentos e maiúsculas. O extrato do jogador **mostra que recebeu R$ 0,01 de arredondamento e por quê** | A soma fecha exatamente no prêmio e o centavo vai para quem o arredondamento mais prejudicou, o que fica próximo do valor exato de cada um. A regra antiga (centavo para quem tem mais minutos) dava a Corvinho, que tinha conta exata, o centavo que faltava a Tuca |
| D10 | Site fora do ar | **Tenta até conseguir, com intervalo crescente**: 1 min, 2 min, 5 min e depois a cada 10 min (*backoff*). A conferência roda em segundo plano, e a tela mostra **"última tentativa às X, próxima às Y"**. Botão **"tentar agora"** com espera de alguns minutos entre cliques; ele **não cria uma consulta paralela**, só antecipa a próxima tentativa do mesmo processo (partida com status "em consulta" ou "conferida" é ignorada). Enquanto isso, a Maria Clara revisa o que já foi conferido. Intervalos **configuráveis**, curtos no modo demonstração, que tem botões para derrubar e religar o site simulado | Não obriga a Maria a vigiar o site. O intervalo crescente não sobrecarrega um site que já está com problema. O controle por status evita duas consultas da mesma partida ao mesmo tempo, o mesmo tipo de problema de concorrência que já resolvi no trabalho |
| D11 | "Por que eu recebi só isso?" | **Duas camadas.** Página **pública** do torneio: classificação, regras, critério de desempate e prêmio por time, sem valores individuais. **Link por time premiado** (com token): o extrato de cada jogador do time, com minutos ou kills, a conta e o centavo de arredondamento, e filtro por nick. A Maria Clara envia **um link para cada time premiado** (normalmente 3; pode ser mais em caso de empate com divisão do prêmio). Times sem prêmio veem só a página pública | Resolve a raiz: o jogador vê a própria conta e a dos colegas sem precisar perguntar. Colegas de time já conhecem os minutos uns dos outros; nenhum valor individual fica exposto para outros times |
| D12 | Pagamento e mensagens | **Fora do escopo:** Pix automático, envio de comprovante e bot do Discord. Ficam como evolução no `DECISIONS.md` | Dinheiro enviado errado não volta; exigiria chave Pix e usuário do Discord de cada jogador; o desafio pede algo menor e bem pensado |
| D13 | Jogador em dois times diferentes | Recebe **como um reserva, pelos minutos, em cada time em que jogou**: os minutos por um time contam na parte daquele time. O sistema mostra um **aviso**, que precisa de "Ciente" como todo item da aba Pendências (D17) | O site confirma que aconteceu de verdade; a regra proporcional já trata a participação em cada time. O "Ciente" segue o princípio de que nada é pago sem a Maria ter visto |
| D14 | Separador do arquivo | O sistema **aceita `;` e `,`**, detectando o separador pela primeira linha. As colunas continuam sendo validadas | Exportações de Excel em inglês ou do Google Planilhas usam vírgula. A Maria Clara não é técnica e não deveria precisar reexportar |
| D15 | Site simulado para setembro | O site repete a planilha, sem a linha duplicada e com o nick `xXSniperXx` correto. Para a partida `#40923` (Falcões x Panteras), o site registra **vitória de Falcões, com 62 kills de Falcões** e 38 minutos para todos (valores por jogador abaixo da tabela). Nenhuma outra divergência | Cria o caso mais rico para a demonstração: empate triplo com 3 vitórias (Corvos, Tubarões, Falcões); as kills põem Corvos em 2º e deixam Tubarões e Falcões empatados também em kills (310), exercitando a divisão igual do 3º lugar (D2) |
| D16 | O que a Maria pode editar | **Só o ID da partida.** Corrigir o ID dispara uma nova consulta **só daquela partida**. Minutos, kills, vencedor e nicks **não são editáveis** | O site é a verdade (D3); editar valores à mão reabriria a porta para erro de digitação virar dinheiro. O ID é a única coisa que só a planilha sabe |
| D17 | Tela de revisão | **Três abas:** **"Conferidas"** (partidas que bateram com o site ou já receberam "Ciente"), **"Pendências"** e **"Aguardando o site"** (partidas ainda não consultadas ou com o site fora do ar). Cada problema aparece **uma vez só**, nunca como pendência local e divergência ao mesmo tempo. **Regra única da aba Pendências: todo item precisa de "Ciente" ou de correção antes do cálculo.** Pedem "Ciente": divergências (D4a), duplicata (D6), nick com caixa diferente (D7) e jogador em dois times (D13). Pedem correção do ID: não encontrada (D5) e times diferentes (D4b). Existe o botão **"Ciente de todas"**. O botão de calcular só libera quando **Pendências** e **Aguardando o site** estão vazias | **Nada é pago sem a Maria ter visto.** Ela vê de cara o que falta fazer e o que depende só de esperar. Um item por problema evita resolver a mesma coisa duas vezes |
| D18 | Leitura da planilha | **Tolerante na forma, rígida no conteúdo.** Aceita: com ou sem BOM, CRLF ou LF; cabeçalho com maiúsculas, acentos e espaços diferentes, `Venceu` sem `?`, colunas em outra ordem e colunas a mais (ignoradas); `Venceu?` como `sim`, `não` ou `nao` em qualquer caixa; data `d/m/aaaa` sem zero à esquerda; ID sem `#` (o sistema acrescenta); espaços em volta dos valores; linhas totalmente vazias (ignoradas). Recusa: coluna obrigatória faltando ou repetida (dizendo qual); data inexistente; rodada que não seja inteiro maior que zero; minutos ou kills vazios, com texto, decimais ou negativos; ID com letras; time ou nick vazios; `Venceu?` com outro valor; arquivo sem nenhuma partida. **Todos os erros são juntados**, com a linha do Excel, e o arquivo inteiro é recusado. **Arquivo que não é UTF-8** é convertido de Windows-1252 automaticamente, e a tela avisa que houve conversão | A Maria não é técnica: diferenças de forma que não mudam o sentido não devem fazê-la reexportar. Já um valor errado de minutos ou kills vira dinheiro errado, então é recusado. Juntar todos os erros evita o vai e vem de corrigir um por vez. O "CSV" do Excel brasileiro grava em Windows-1252; a comparação com o site (parte 2) é a rede de segurança para um nick que chegue estranho |
| D19 | Comparação planilha × site | **Ordem de prioridade, um item por problema:** (1) não encontrada e (2) times diferentes pedem correção do ID e nenhum outro item da partida; (3) partida zerada na planilha vira **um** item "usamos os dados do site"; (4) duplicata é **um** item, com as linhas da planilha e o valor do site, mesmo que as linhas tenham valores diferentes, e sem itens de valor; (5) nick escrito diferente; (6) vencedor (um item por partida), minutos, kills ou **time do jogador** diferentes; (7) jogador só no site ou só na planilha; (8) jogador em dois times, calculado **só com os dados do site**, um item por jogador no torneio. Nomes de time são comparados **ignorando acentos e maiúsculas**: "Falcoes" é Falcões, gera um aviso por time no torneio e não "times diferentes". **Data e rodada diferentes não geram item.** "Time errado" (planilha × site na mesma partida) e "dois times" (só o site) são problemas diferentes: podem gerar dois itens | Cada problema aparece uma vez, com a ação certa. Corrigir o ID só resolve quando o ID está errado; uma grafia de time não é ID errado. Data e rodada não mudam o dinheiro: mostrar seria ruído |
| D20 | Percentuais e centavos entre posições | **Os percentuais precisam ser inteiros e somar 100%**, validados na criação do torneio, com a mensagem "Os percentuais precisam somar 100". Quando um percentual não dá centavo inteiro (ex.: R$ 1.234,57 × 50% = R$ 617,285), **o prêmio é dividido entre as posições pelo maior resto**, com os percentuais como pesos; empate na fração vai para a **melhor colocada**. Ex.: R$ 1.234,57 em 50/30/20 = R$ 617,29 + R$ 370,37 + R$ 246,91. Times empatados somam os valores já arredondados das posições que ocupam | 100% garante que o que a Maria anuncia é exatamente o que é pago. Com o maior resto, qualquer valor de prêmio é aceito e a regra de arredondamento continua uma só (D9) |
| D21 | Modo kills: jogador ou time sem kills | **Jogador com 0 kills recebe R$ 0** no modo kills (consequência da D1, mantida). **Time premiado em que ninguém fez kills:** o prêmio do time é **dividido pelos minutos**, e o extrato explica: "Ninguém do time fez kills; o prêmio foi dividido pelos minutos jogados." Ao escolher o modo kills, a tela de criação avisa as duas coisas | Sem kills não há proporção. Os minutos ainda medem a participação (D8); dividir igual daria ao reserva de 19 minutos o mesmo que aos titulares; bloquear travaria o prêmio, porque o modo não pode mudar depois (D1). O aviso deixa a consequência do modo kills clara antes da escolha |

**Dados da `#40923` no site simulado (D15):** data 19/09/2026, rodada 5, vencedor Falcões, 38 minutos para cada jogador.

| Falcões | Kills | Panteras | Kills |
|---|---|---|---|
| Falk | 14 | Sombra | 7 |
| Kiwi | 11 | Pantera_X | 12 |
| Dudu.pro | 16 | Mel | 9 |
| Marreta | 13 | Tchê | 10 |
| Sol | 8 | Rafa.K | 7 |
| **Total** | **62** | **Total** | **45** |

---

## 12. Fluxo da Maria Clara (resultado das decisões)

1. Cria o torneio: nome, prêmio, percentuais e **forma de divisão** (minutos ou kills, travada depois do cálculo).
2. Sobe a planilha.
3. O sistema valida o arquivo (colunas, separador) e cria as partidas como **aguardando o site**.
4. Em segundo plano, confere cada partida no site oficial. Se o site estiver fora do ar, **tenta até conseguir**, com intervalos de 1, 2, 5 e depois 10 minutos (D10).
5. Na tela de revisão (D17), com as abas **Conferidas**, **Pendências** e **Aguardando o site**:
   - divergências de minutos, kills, vencedor ou jogadores, duplicatas, nicks com caixa diferente e jogador em dois times aparecem lado a lado (planilha × site), e ela clica em **"Ciente"** ou **"Ciente de todas"** (D4, D6, D7, D13);
   - ID não encontrado ou de uma partida de outros times: ela **corrige o ID** e só aquela partida é consultada de novo (D4, D5, D16).
6. Com Pendências e Aguardando vazias, calcula: classificação, desempate (com justificativa), prêmio por time e por jogador, centavos fechando no total.
7. Gera a **página pública** (classificação, regras, desempate e prêmio por time, sem valores individuais) e **um link por time premiado**, com o extrato de cada jogador do time e filtro por nick (D11).

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

**Premissas dos resultados esperados:** prêmio de R$ 10.000,00 (50/30/20), divisão por **minutos**, desempate por kills do time, empate também em kills divide igual, centavos que sobram pelo **maior resto** e, no empate da fração, ordem alfabética (D9).

| Cenário | Arquivo | O que tem | O que o sistema deve fazer |
|---|---|---|---|
| 01 | `01-limpa.csv` | 6 times, 15 partidas, sem erros. Dois jogadores saíram mais cedo (Escama na rodada 2, Cinzas na rodada 4) | Conferir tudo sem divergência e calcular. Dragões 1º (R$ 5.000), Fênix 2º (R$ 3.000), Leões 3º (R$ 2.000). Dentro dos Dragões, Escama (saiu mais cedo) recebe R$ 880,96 e Brasa.gg, Fogaréu, Labareda e Rugido R$ 1.029,76: o centavo foi para Escama, que tinha a maior fração (D9). Em Fênix, o centavo vai para Cinzas (R$ 558,32). Valores por jogador em `esperado/01-limpa-jogadores.csv` |
| 02 | `02-id-inexistente.csv` | A partida `#52241` foi digitada como `#52214` (dígitos invertidos) | O site responde "não encontrada" para `#52214`. Mostrar a partida em Pendências e **bloquear o cálculo** (D5). A Maria corrige o ID para `#52241`, o sistema consulta só essa partida e libera (D16) |
| 03 | `03-divergencias.csv` | Três diferenças entre planilha e site: Juba (`#53132`) kills 18 × 8; Plumada (`#53428`) minutos 15 × 27; Harpia (`#53718`) kills 9 × 13 | Listar as 3 divergências **lado a lado** (planilha × site) em Pendências; o cálculo só libera depois do **"Ciente"** (um a um ou "Ciente de todas") e usa os valores do site (D3, D4) |
| 04 | `04-empate-em-kills.csv` | Fênix e Leões com 3 vitórias e **398 kills cada**. Fênix venceu Leões no confronto direto, mas esse critério não é usado | Dividir 30% + 20% igualmente: **R$ 2.500 para cada time**, com a justificativa visível. Lobos-Guará e Ursos também empatam em vitórias (4º e 5º), mas sem prêmio |
| 05 | `05-oito-times.csv` | 8 times, 7 rodadas, 28 partidas, sem erros | Conferir 28 partidas sem travar a tela. Dragões 1º, Fênix 2º, Leões 3º |
| 06a | `06a-coluna-faltando.csv` | Sem a coluna `Kills` | **Recusar o arquivo** com mensagem clara dizendo qual coluna falta |
| 06b | `06b-separador-virgula.csv` | Separador `,` em vez de `;` | Detectar o separador e importar normalmente (D14) |
| 07 | `07-jogador-em-dois-times.csv` | Na rodada 4, **Garra** joga pelos Leões e também pelos Ursos (no lugar de Pardo). O site confirma: não é erro de digitação | Aviso em Pendências, que libera o cálculo depois do "Ciente" (D13, D17). Garra recebe pelos minutos em cada time |
| Extra | `torneio-outubro.csv` | Torneio normal. Na rodada 3, Bico (Águias) sai aos 15 minutos e entra o reserva **Sabiá** | Calcular normalmente; Sabiá recebe pelos minutos (D8), R$ 74,63, com o centavo de arredondamento (D9). Leões 1º, Águias 2º, Dragões 3º |
| Extra | `torneio-novembro.csv` | Os mesmos problemas de digitação de setembro: `mel.zinho` em minúsculas na rodada 2 e **Rapina duplicado** na rodada 4. Além disso, **duas partidas instáveis no site**: `#62142` falha 2 vezes antes de responder e `#62477` falha 5 vezes | Avisos com "Ciente", um item cada, com o lado a lado do site: `mel.zinho` × Mel.zinho (D7) e a duplicata de Rapina (D6). As partidas instáveis ficam em "Aguardando o site" e são tentadas de novo até responderem (D10) |
| Setembro | `torneio-setembro.csv` (original) | Os problemas da seção 6: duplicata de Pantera_X, `xxsniperxx`, a substituição de Tuca e a `#40923` zerada. O site tem os dados da `#40923` (D15) | Avisos com "Ciente" para a duplicata e o nick (D6, D7); a `#40923` é preenchida pelo site, sem bloquear (D3). Resultado esperado abaixo |

**Resultado esperado de setembro (por minutos), conferido com script sobre a planilha original e os dados da D15:**

| Posição | Time | Vitórias | Kills | Prêmio do time | Por jogador |
|---|---|---|---|---|---|
| 1º | Lobos | 5 | 353 | R$ 5.000,00 | 5 × R$ 1.000,00 (211 min cada) |
| 2º | Corvos | 3 | 368 | R$ 3.000,00 | Corvinho, M4theus, Zeca e Nina.exe R$ 600,00 (173 min); Bia.gg R$ 534,10 (154 min); Tuca R$ 65,90 (19 min, +1 centavo pelo maior resto, D9) |
| 3º (empate) | Tubarões | 3 | 310 | R$ 1.000,00 | 5 × R$ 200,00 (179 min cada) |
| 3º (empate) | Falcões | 3 | 310 | R$ 1.000,00 | 5 × R$ 200,00 (180 min cada) |
| 5º | Panteras | 1 | 269 | — | — |
| 6º | Serpentes | 0 | 249 | — | — |

Tubarões e Falcões empatam em vitórias e em kills: o prêmio do 3º lugar (R$ 2.000,00) e o do 4º (R$ 0) somam-se e dividem-se igualmente (D2). A justificativa precisa aparecer na página pública. Soma paga: R$ 10.000,00.

**A planilha original da empresa (`torneio-setembro.csv`) fica congelada até o fim do projeto:** ela é usada exatamente como foi enviada, para testar a solução. As planilhas de `testes/` podem ser ajustadas ou ampliadas depois da entrega.

**Ainda não incluído:** os dados de setembro em `testes/site-oficial.json`. Os valores já estão definidos (D15) e o esperado já existe em `testes/esperado/torneio-setembro-*.csv`; entram no site na etapa 2, sem alterar a planilha original.

**Sem cenário ainda:** ID que, no site, corresponde a uma partida de outros times (D4, tipo b). Fica para quando os cenários forem ampliados.


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
