# Decisões

> Registro das decisões do projeto, com as alternativas descartadas.
> A tabela completa das regras de negócio (D1 a D17) está na seção 11 do `contexto.md`. Este arquivo é completado na etapa 8, com o que ficou de fora por falta de tempo.

---

## Revisão de 14/10/2026: o site oficial é a verdade, de ponta a ponta

Ao planejar a etapa 0, apareceram lacunas: o que fazer com a partida `#40923` zerada na planilha, o que a Maria faria com um ID não encontrado e como evitar que o mesmo problema aparecesse duas vezes (como pendência local e como divergência). A resposta veio de levar a D3 (o site é a fonte da verdade) até o fim.

| # | Decisão | Alternativa descartada | Por que descartada |
|---|---|---|---|
| D3 | O site preenche o que falta: partida zerada ou vazia na planilha vale o site, sem bloquear | Tratar a `#40923` zerada como divergência que bloqueia | A planilha vazia não é uma informação conflitante, é falta de informação; bloquear só daria trabalho à Maria |
| D4 | Minutos, kills ou vencedor diferentes: usa o site e pede só **"Ciente"**. Times diferentes: bloqueia até corrigir o ID | Bloquear qualquer divergência até a Maria escolher o valor | Não há escolha real a fazer se o site é a verdade; o "Ciente" garante que ela viu antes de pagar. Times diferentes indicam que a partida certa nem foi consultada |
| D5 | Toda partida precisa existir no site. "Não encontrada" = ID errado, a Maria corrige o ID | A Maria informar o resultado à mão (vitória, W.O., partida não realizada) | Um erro de digitação dela viraria Pix errado e perda de confiança dos jogadores. Também elimina regras de W.O. que ninguém pediu |
| D6 | Duplicata vira aviso com "Ciente", sem bloquear | Destacar em amarelo e bloquear até a Maria editar ou remover | O cálculo usa o site, onde o jogador aparece uma vez; a duplicata não muda o dinheiro |
| D7 | Nick com caixa diferente vira aviso com "Ciente", sem bloquear | Perguntar se é a mesma pessoa e unificar os nicks | O cálculo usa o nick do site; não há o que unificar (isso também tirou a tabela `nicks` do banco) |
| D15 | Na `#40923`, o site registra vitória de Falcões com 62 kills | 63 kills ou mais (Falcões passaria Tubarões) | Com 62, Tubarões e Falcões empatam também em kills (310) e dividem o 3º lugar: a demonstração exercita o último critério da D2 (divisão igual) com dados reais |
| D16 | A Maria só edita o ID da partida, e isso dispara nova consulta só daquela partida | Editar minutos, kills e remover linhas | Editar valores reabriria a porta para erro de digitação virar dinheiro; o ID é a única coisa que só a planilha sabe |
| D17 | Revisão em três abas (Conferidas, Pendências, Aguardando o site); cada problema aparece uma vez | Listas separadas de pendências locais e divergências | Um problema mostrado em dois lugares seria resolvido duas vezes; separar o que depende dela do que depende do site deixa claro o que falta |

**Efeito no banco:** `divergencias` e `pendencias` viraram uma tabela só (`pendencias`), um item por problema.

---

## Revisão de 14/10/2026 (2): arredondamento e regra única de pendências

| # | Decisão | Alternativa descartada | Por que descartada |
|---|---|---|---|
| D9 | **Maior resto:** cada um recebe a parte inteira em centavos; os centavos que sobram vão para quem tem a maior parte fracionária; empate na fração, ordem alfabética. **Uma regra só no sistema todo** | Centavo para quem tem mais minutos (ou kills), e no empate ordem alfabética do nick | Em Corvos, setembro: Corvinho, com conta exata de R$ 600,00, levaria o centavo e receberia R$ 600,01, enquanto Tuca, cuja conta exata é R$ 65,895, ficaria com R$ 65,89. O centavo ia para quem não perdeu nada no corte e saía de quem mais perdeu. Com o maior resto, Tuca recebe R$ 65,90, o valor mais próximo do exato |
| D2 | Centavos entre times empatados (ex.: R$ 5.000 entre 3): mesma regra da D9, com a ordem alfabética do nome do time | Uma regra própria para times | Duas regras de arredondamento seriam duas coisas a explicar e a testar |
| D4 | Jogador que está no site e não na planilha, ou o contrário: divergência com "Ciente". O cálculo usa os jogadores do site | Bloquear até a Maria decidir | Coerente com a D3: o site é a verdade, a Maria só precisa ver |
| D13, D17 | **Todo item de Pendências precisa de "Ciente" ou de correção**, inclusive o jogador em dois times. Existe "Ciente de todas" | Avisos só informativos, que não exigem nada | Princípio: nada é pago sem a Maria ter visto. Uma regra única é mais simples de explicar do que "alguns avisos bloqueiam, outros não" |

**"Ordem alfabética"** é a de dicionário: ignora acentos e maiúsculas ("Águias" antes de "Ursos"), para não depender da ordem dos códigos Unicode.

---

## Leitura da planilha (D18), 14/10/2026

Princípio: **tolerante na forma, rígida no conteúdo.** O que não muda o sentido é aceito; o que pode virar dinheiro errado é recusado.

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| Arquivo que não é UTF-8 é **convertido de Windows-1252** automaticamente, e o resultado avisa que houve conversão, para a tela mostrar | Recusar e pedir para salvar como "CSV UTF-8" | O "CSV (separado por vírgulas)" do Excel brasileiro grava em Windows-1252, e a Maria não é técnica. Se a conversão errar um acento, o nick aparece como divergência na comparação com o site (parte 2) |
| Cabeçalho tolerante: maiúsculas, acentos, espaços, `Venceu` sem `?`, outra ordem, colunas a mais | Exigir o cabeçalho exatamente igual | Reexportar por causa de uma maiúscula não protege ninguém; as colunas obrigatórias continuam exigidas, e a mensagem diz qual falta ou está repetida |
| `Venceu?` aceita `sim`, `não` e `nao`, em qualquer caixa; outros valores são erro | Aceitar também `s`/`n` | `s` e `n` já são abreviação: começa a ser palpite. A lista curta é fácil de explicar na mensagem |
| Minutos ou kills vazios são erro | Tratar vazio como 0 | Vazio pode ser esquecimento; a planilha usa `0` explícito quando é zero (`#40923`) |
| Todos os erros são juntados e o arquivo inteiro é recusado | Parar no primeiro erro, ou importar só as linhas boas | Um erro por vez obriga a Maria a subir o arquivo várias vezes. Importar pela metade deixaria partidas de fora do torneio sem ela perceber |
| Data `d/m/aaaa` aceita; data impossível (31/02) é erro | Aceitar só `dd/mm/aaaa` | O Excel às vezes exporta sem o zero à esquerda |
| ID sem `#` ganha o `#`; ID com letras é erro | Exigir o `#` | O `#` é só formatação; com letras, o site nunca vai achar a partida |

**Detalhes técnicos:** a função recebe os **bytes** do arquivo, porque só assim dá para saber se é UTF-8. Aspas no padrão CSV são respeitadas (um nick com vírgula num arquivo separado por vírgula). A data sai como texto `aaaa-mm-dd`, sem objeto `Date`, para não depender de fuso horário.

---

## Comparação planilha × site (D19), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| **Data e rodada diferentes não geram item** (decisão consciente) | Gerar um item de data para a Maria saber que digitou errado | Não mudam o dinheiro: a classificação vem do vencedor e a divisão, de minutos ou kills. Um item a mais na aba Pendências é um clique a mais sem efeito no pagamento |
| Nome de time com acento ou maiúscula diferente ("Falcoes") é comparado sem acentos: gera **um aviso por time no torneio**, com "Ciente" | Tratar como "times diferentes" e pedir para corrigir o ID | O ID está certo; corrigir não resolveria nada e bloquearia o cálculo à toa |
| Jogador no time errado na planilha (site diz outro time, mesma partida): **divergência do campo `time`**, com "Ciente" | Tratar como "jogador em dois times" | "Dois times" é calculado só com o site (D13). Se os dois acontecem, são dois itens, porque são problemas diferentes |
| Duplicata com valores diferentes (20 e 22 min): **um único item**, com as duas linhas da planilha e o valor do site | Um item de duplicata e outro de valor | O cálculo usa o site de qualquer forma; dois itens para o mesmo problema contrariam a D17 |
| Partida zerada na planilha (`#40923`): **um item da partida** | Um item por jogador | Dez itens de "0 × 38 minutos" escondem o que aconteceu: a planilha simplesmente não tinha os dados |
| Vencedor da planilha calculado pelas linhas: o time com todas as linhas "sim". Tudo vazio ou combinação incoerente também vira divergência de vencedor | Um item de vencedor por jogador | O vencedor é da partida, não do jogador |

**Detalhes técnicos:** a função recebe as linhas lidas e as respostas do site já obtidas (sem chamada HTTP). Partida sem resposta fica em "Aguardando o site", sem item. Partidas com item de corrigir ID ficam fora dos dados oficiais do cálculo.

---

## Classificação (D2), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| A classificação diz só o fato: **"empate em vitórias e kills"** ou **"desempate por kills do time"**. O cálculo do prêmio (parte 4) acrescenta "divisão igual" quando houver prêmio dividido | Usar na classificação o texto "divisão igual (empate em vitórias e kills)" dos esperados | "Divisão igual" fala de dinheiro. Dois times empatados em 5º não dividem nada, e o texto ficaria errado. Os esperados não mudaram: o teste compara a parte entre parênteses |
| Posição compartilhada no empate total, com o próximo pulando (1, 2, 3, 3, 5) | Numerar em sequência (1, 2, 3, 4, 5) | Quem empatou em tudo ficou na mesma colocação; a numeração sequencial sugeria uma diferença que não existe |
| Entre times na mesma posição, ordem alfabética de dicionário (ignora acentos e maiúsculas) | Ordem dos códigos Unicode, que põe "Águias" depois de "Ursos" | É a ordem que uma pessoa espera ver numa tabela |

---

## Prêmio por time: percentuais e centavos entre posições (D20), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| **Percentuais precisam somar 100%**, validado na criação do torneio: "Os percentuais precisam somar 100" | Aceitar menos de 100%, com o resto ficando com a organizadora | O que a Maria anuncia precisa ser exatamente o que é pago. Com menos de 100%, a página pública teria de explicar um valor que ninguém recebe |
| Percentual que não dá centavo inteiro: **o prêmio é dividido entre as posições pelo maior resto**, com os percentuais como pesos; empate na fração vai para a melhor colocada. R$ 1.234,57 em 50/30/20 = R$ 617,29 + R$ 370,37 + R$ 246,91 | Exigir na criação que todas as contas deem centavos inteiros | A Maria não entenderia por que R$ 1.234,57 é recusado. Com o maior resto, a regra de arredondamento continua uma só (D9) |
| No empate de fração entre posições, o centavo vai para a **melhor colocada** | Ordem alfabética, como entre jogadores e times | Uma posição não tem nome; quem ficou na frente é o critério natural. A função de maior resto ganhou a opção "ordem da lista", e o padrão continua alfabético |
| Mais posições premiadas do que times (ex.: 50/30/20 com 2 times): **erro claro** | Distribuir o percentual que sobra | Não é um caso real com 6 times; distribuir seria inventar regra. Fica registrado para a criação do torneio tratar |

---

## Divisão entre jogadores no modo kills (D21), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| **Jogador com 0 kills recebe R$ 0** no modo kills. A regra não muda; a tela de criação avisa ao escolher o modo: "Jogadores sem nenhuma kill não recebem prêmio. Se ninguém do time fizer kills, o prêmio do time é dividido pelos minutos." | Dar um mínimo a quem jogou sem fazer kills | Seria uma terceira regra de divisão, que ninguém pediu. É a consequência direta de dividir por kills (o caso do Dona.Tank, seção 8 do `contexto.md`): melhor deixar claro antes da escolha do que remendar depois |
| Time premiado em que **ninguém fez kills: divide pelos minutos**, e o extrato explica | Dividir igual entre os jogadores do time | O reserva de 19 minutos receberia o mesmo que os titulares |
| (mesma) | Bloquear o cálculo | Não haveria saída: o modo é escolhido antes da planilha e não muda depois (D1); o prêmio ficaria travado |

---

## Site oficial simulado: consulta de partida (etapa 2a), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| ID na URL **só com os números**: `GET /partidas/40923`; o servidor acrescenta o `#`. `%2340923` (o `#` codificado) também é aceito | `GET /partidas/#40923` | O navegador trata tudo depois do `#` como fragmento e não envia ao servidor: a consulta chegaria como `/partidas/` |
| (mesma) | Exigir `%2340923` | Funciona, mas é feio e fácil de errar à mão |
| Três respostas distintas: **200** com a partida, **404 `{ status: "nao_encontrada" }`** para ID que não existe, **400** para ID que não é número | Responder 404 para tudo | "Não encontrada" é uma resposta válida do site e vira pendência de corrigir o ID (D5); um pedido mal feito é erro do cliente. Misturar os dois esconderia um bug |
| A configuração do simulador (`falhas_antes_de_responder`) **não aparece na resposta** | Devolver o objeto do arquivo como está | O site real não teria esse campo; a API não deve depender dele |
| Mesmo ID em dois arquivos de dados: **o simulador não sobe** | Ficar com o último arquivo lido | Escolher em silêncio esconderia um erro nos dados de teste |
| Dados lidos ao subir, montados **somente leitura** no Docker | Copiar os arquivos para dentro da imagem | Com `:ro`, o simulador não consegue alterar os dados de teste, e mudar os dados não exige reconstruir a imagem |

## Site oficial simulado: demora e falhas (etapa 2b), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| Falha por partida = **503 `{ status: "indisponivel" }`**, depois da demora normal | Deixar a conexão pendurada até o tempo esgotar | 503 é o que um site fora do ar costuma devolver e é distinto de 404 (não existe) e 400 (pedido mal feito). A conexão pendurada existe como um dos modos de derrubar o site (2c). Quem tenta consultar de novo é o job de conferência da **etapa 4**, em dois casos: **503** e **site sem resposta (tempo esgotado)**; 404 e 400 não são tentados de novo |
| A demora vale também para "não encontrada" e para a falha; o 400 (ID inválido) responde na hora | Demorar só nas respostas com a partida | O site real demora para dizer que não achou ou para cair; o 400 é recusado antes de "consultar" |
| Demora de **2 a 10 s por padrão**, configurável por `SITE_DEMORA_MIN_MS` e `SITE_DEMORA_MAX_MS` | Demora fixa | O padrão imita o site real; a demonstração encurta no `.env` sem mexer no código |
| O contador de falhas fica **na memória** e zera quando o simulador reinicia | Guardar em arquivo | Reiniciar o simulador para repetir a demonstração é justamente o que se quer; e os arquivos de dados são somente leitura |
| A espera e o sorteio **entram por parâmetro** no app | Testar com a demora de verdade, ou com relógio falso global | O teste controla quando a resposta sai, sem esperar nem mexer no relógio do processo |

## Site oficial simulado: modo demonstração (etapa 2c), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| **Dois modos de queda:** com erro (503 na hora) e sem resposta (a conexão fica pendurada) | Só o modo com erro | Os dois são os casos em que a etapa 4 tenta de novo; sem o modo pendurado, o limite de tempo do cliente nunca seria testado |
| **Só as consultas de partida caem;** `/saude` e `/demo` continuam de pé | Derrubar o serviço inteiro | Com tudo fora, não daria para religar pela página |
| Ao religar, as conexões penduradas são **encerradas**, sem resposta tardia | Responder às penduradas quando o site voltar | No site real, uma consulta que ficou sem resposta está perdida; responder depois esconderia o problema que o limite de tempo do cliente precisa resolver |
| Com o site fora, as partidas instáveis **não gastam** as falhas delas | Contar a queda como uma das falhas | Cair e falhar são coisas diferentes; misturar faria a demonstração das partidas instáveis depender de quantas vezes o site foi derrubado antes |
| Estado da queda **na memória**; o modo demonstração está sempre disponível no simulador | Ligar o modo por variável de ambiente | O simulador só existe para testes e demonstração; reiniciar volta ao estado "no ar" |
| Página em HTML simples, servida pelo próprio simulador, com um campo para consultar uma partida | Uma tela no front da Maria | O simulador representa um sistema de fora; os controles dele não pertencem ao sistema dela |

---

## Banco de dados da importação (etapa 3a), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| Nick, time e ID da partida com collation **`utf8mb4_0900_as_cs`** (diferencia acentos e maiúsculas) | O padrão do MySQL 8, `utf8mb4_0900_ai_ci` | O padrão trata "xxsniperxx" e "xXSniperXx", ou "Falcoes" e "Falcões", como iguais. Num `GROUP BY` ou numa chave única, o banco juntaria em silêncio o que o domínio decide com aviso e "Ciente" (D7, D19) |
| O torneio foi completado por uma **migration nova (002)** | Editar a 001 | A 001 já rodou nos bancos; uma migration aplicada não muda, senão os bancos ficam diferentes entre si |
| Status **`criado`**, antes da planilha | Nascer como "importado" | O torneio é criado (nome, prêmio, percentuais, modo) antes de a planilha chegar |
| `linhas_planilha` ligada a `partidas` por **chave estrangeira** | Ligar pelo texto do ID da partida | A Maria pode corrigir o ID (D16); pela chave, a ligação continua certa. O ID digitado fica guardado na linha |
| Sem a coluna `situacao` (ok/duplicada) nas linhas | Marcar a duplicata na importação | Duplicata virou pendência da comparação com o site (D19); a linha é guardada exatamente como veio |
| `partidas` já nasce com os campos da conferência, inclusive **`em_consulta_desde`** e **`ultimo_erro`** | Acrescentar na etapa 4 | Ela é a tabela de tarefas. `em_consulta_desde` permite recuperar uma partida presa se o job cair no meio; `ultimo_erro` é o que a tela mostra |
| A fonte de migrations registra sempre o nome com **`.js`** | O padrão do Knex (nome com a extensão do arquivo) | No contêiner o arquivo é `.js`, fora dele `.ts`: o Knex acusaria a pasta como corrompida ao alternar entre `npm run dev` e o Docker |
| DATE volta do banco como **texto `aaaa-mm-dd`** | Objeto `Date` | Uma data sem hora não tem fuso; como `Date`, o 19/09 poderia virar 18/09 na conversão |
| Testes de integração num banco **`torneios_teste`, recriado do zero** a cada execução, com `npm run test:integracao` | Usar o banco de desenvolvimento, ou rodar junto com `npm test` | Os testes não apagam dados de quem está desenvolvendo, e as próprias migrations são testadas. O `npm test` continua sem precisar de banco |
| Repositórios recebem o **executor** (conexão ou transação) | Cada repositório usar a conexão global | Quem orquestra (o serviço da importação, no 3b) abre uma transação e passa para todos: se algo falha, nada fica gravado pela metade |

---

## API de torneio e importação (etapa 3b), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| **Enviar a planilha de novo substitui a anterior inteira**, enquanto o torneio não foi calculado; a tela confirma antes (D22) | Proibir o reenvio (criar outro torneio) | Deixaria torneios abandonados e obrigaria a digitar tudo de novo por um erro de digitação |
| (mesma) | Substituir só as partidas que mudaram | Economizaria consultas ao site, mas misturar conferência antiga e planilha nova é fácil de errar |
| Depois do cálculo, reenviar responde **409** | Permitir e recalcular | O resultado já foi visto e divulgado; mudar a base depois é o que a D1 quer evitar |
| **Partida com um time só ou com mais de dois: o arquivo é recusado**, listando todas as linhas envolvidas (D23) | Aceitar e deixar a comparação com o site apontar | Viraria "times diferentes", e corrigir o ID da partida inteira não separa a linha errada |
| A importação **trava a linha do torneio** (`SELECT ... FOR UPDATE`) durante a transação | Não travar | Dois envios ao mesmo tempo (dois cliques, duas abas) poderiam misturar as planilhas |
| `PUT /torneios/:id/planilha`, com o arquivo **direto no corpo** e o nome no cabeçalho `X-Nome-Arquivo` | `POST` com multipart (formulário de upload) | "A" planilha do torneio é um recurso único: enviar de novo substitui. O corpo direto dispensa uma biblioteca de upload; o navegador envia o `File` do mesmo jeito |
| Prêmio sempre em **centavos inteiros** na API; a tela converte "R$ 10.000,00" | Aceitar texto em reais na API | Um formato só, sem ambiguidade de vírgula e ponto, e sem float |

### Limitação conhecida: o sistema não tem login

As confirmações na tela (substituir a planilha, calcular) evitam um **clique por engano**, mas **não impedem outra pessoa** que chegue à tela da Maria de criar torneios, subir planilhas ou calcular. Os links dos times premiados usam **token** (D11), então só quem recebeu o link vê os valores do time. **Autenticação da Maria fica como evolução:** num torneio amador, com a tela rodando no computador dela, o risco é baixo, e um login bem feito (senhas, sessão, recuperação de acesso) é um projeto à parte.

---

## Telas de criar torneio e subir planilha (etapa 3c), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| **Prêmio digitado em reais, no formato brasileiro**, e convertido para centavos **só com texto e inteiros** (`lerReais`): aceita `R$ 10.000,00`, `10.000,00`, `10000` e `10000,5`; pontos só como milhar, em grupos de 3; vírgula com 1 ou 2 dígitos | `parseFloat` depois de trocar vírgula por ponto | `parseFloat` passa por float: o tipo de erro que a regra "dinheiro em centavos" existe para evitar |
| (mesma) | Campo em centavos | A Maria não é técnica; ninguém pensa num prêmio como "1000000" |
| **Formato americano (`10,000.00`) é recusado**, com a frase do formato certo | Tentar adivinhar | "10,000" no Brasil seria dez reais com três casas; adivinhar errado multiplica o prêmio por mil |
| Prêmio com **limite de R$ 42.949.672,95** na tela, o mesmo da coluna do banco | Deixar só a API recusar | A Maria vê o motivo no campo, antes de enviar |
| **Percentuais: começa em 50/30/20**, com adicionar e remover posição e **soma ao vivo**. A tela não envia o que já sabe que está errado, mas **a validação que vale é a da API** (mesmas frases da D20) | Validar só na API | O erro só apareceria depois de enviar; a soma ao vivo mostra na hora quanto falta |
| Confirmação de substituir a planilha (D22) num **`<dialog>` do navegador**, com o nome do arquivo atual e do novo | `window.confirm` | O `confirm` não deixa mostrar os dois nomes de arquivo nem destacar o botão; o `<dialog>` já prende o foco e fecha com Esc |
| Erros da planilha numa **tabela linha × coluna × problema**, com todas as linhas da partida quando o erro é de uma partida inteira (D23) | Uma lista de frases | A Maria procura no Excel pela linha; a tabela deixa a linha sempre no mesmo lugar |
| **`GET /torneios`** para a página inicial, o mais novo primeiro, com a quantidade de partidas, **sem paginação** | Paginar | A Maria organiza poucos torneios por ano; paginar seria código sem uso |
| **vue-router 4** | vue-router 5 | A versão 5 pede Vite 7 (por causa do roteamento por arquivos, que não usamos); trocar o Vite agora seria mexer no que funciona |
| **Fontes dentro do projeto** (pacotes `@fontsource`, só os pesos usados e o alfabeto latino) | Google Fonts | A demonstração precisa funcionar sem internet |
| `formatarCentavos` **repetido no web** | Pacote compartilhado entre API e web | Seria um quarto pacote no monorepo e no Docker por uma função de 10 linhas; as duas cópias têm testes |
| A página inicial virou a **lista de torneios**; o status da API e do banco foi para o rodapé | Manter a página de status | Ela provava que as camadas conversavam (etapa 0); agora a lista prova o mesmo e é útil |

**O que ficou de fora, por tempo:** testes de componente do Vue (`@vue/test-utils`). O Vitest do web testa as regras puras da tela (prêmio, percentuais, quando pedir confirmação, rótulos); as interações (confirmar e cancelar a substituição, planilha recusada, soma ao vivo, criar com erro e corrigir) foram conferidas num navegador de verdade, mas não ficaram automatizadas no repositório.

---

## Consulta ao site oficial (etapa 4a), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| O job vai conhecer só a interface **`SiteOficial`** (`consultarPartida`), com três resultados: **encontrada**, **não encontrada** e **indisponível** | O job chamar o `fetch` direto | Trocar o simulado pelo site real, ou a consulta direta por uma fila, mexeria na regra da conferência |
| **Só o 404 não é tentado de novo.** Tudo o que não é 200 válido nem 404 é **indisponível**, com o motivo guardado: 503, tempo esgotado, erro de rede, **outro código (400, 500, 502...) e resposta fora do formato** | Tratar o 400 como erro definitivo, como o plano dizia | O sistema só manda IDs válidos (D18), então um 400 só aparece se o site mudar ou tiver um defeito. A partida não tem um estado "erro definitivo"; tentar de novo com intervalo crescente não sobrecarrega o site, e o motivo aparece na tela em "Aguardando o site" |
| Resposta 200 **validada com Zod** antes de usar; fora do formato vira indisponível | Usar o que vier | Uma partida com minutos em texto ou sem jogadores viraria dinheiro errado. O sistema prefere esperar a usar dado pela metade |
| O **tempo limite cobre a consulta inteira**, até o fim do corpo | Só até chegar o cabeçalho (o padrão de muitos clientes) | O site pode responder o cabeçalho e travar no meio: a consulta ficaria pendurada para sempre |
| **Tempo limite de 15 s**, e a **API não sobe** se ele não passar da demora máxima do site (`SITE_DEMORA_MAX_MS`) | Um valor fixo | Abaixo da demora normal, toda consulta lenta mas certa viraria falha. Na demonstração os dois podem ser encurtados juntos |
| O tempo limite usa um **cronômetro injetado** (`Cronometro`); o teste decide quando ele esgota | Esperar de verdade no teste, ou falsificar os timers do Node | Esperar 15 s deixaria os testes lentos. Os timers falsos do Vitest também afetam os do `fetch` por dentro. É o mesmo padrão da demora do site simulado (`esperar`) |
| **Próxima tentativa** numa **função pura** (`proximaTentativa`): 1, 2, 5 e depois 10 min, **sem limite de tentativas**, com os intervalos em `CONFERENCIA_INTERVALOS_MS` | Desistir depois de N tentativas | Toda partida precisa ser conferida no site (D5): desistir deixaria o torneio travado sem a Maria saber por quê |

**Não testado automaticamente:** o cronômetro de verdade (`setTimeout`, três linhas). Os testes usam o cronômetro injetado para não esperar.

---

## Job da conferência (etapa 4b), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| O job roda **dentro do processo da API**: o servidor liga ao subir e desliga ao encerrar, esperando a rodada em andamento | Processo separado (outro serviço no Docker) | Um serviço a mais para subir e explicar, sem ganho para 15 a 28 partidas. O código fica isolado em `conferencia/` (`iniciarJob`); virar processo separado é um arquivo de entrada novo. Com SKIP LOCKED, várias execuções ao mesmo tempo continuam seguras |
| **Lote de 3 partidas consultadas em paralelo** (`CONFERENCIA_LOTE`) | Uma por vez | Setembro levaria até 2,5 min, e 8 times quase 5 min: a dor que a Maria já tem |
| (mesma) | Todas de uma vez | Dezenas de pedidos ao mesmo tempo num site que já é instável |
| **Reserva numa transação curta**; a consulta ao site (2 a 10 s) acontece **fora** dela | Manter a transação aberta durante a consulta | Travaria a partida, e uma conexão do banco, por até 15 s por consulta |
| A reserva funciona como um **recibo** (`em_consulta_desde`): a gravação só acontece se a partida ainda existir e continuar reservada com o mesmo recibo | Gravar sempre | Uma partida apagada pela planilha nova (D22), ou recuperada e reservada por outra execução, receberia dados de uma consulta velha. O resultado é descartado sem erro |
| O recibo (`em_consulta_desde`) é **`DATETIME(3)`, com milissegundos** (migration 006) | `DATETIME` em segundos | Em segundos, duas reservas da mesma partida no mesmo segundo tinham o mesmo recibo, e a consulta antiga gravava por cima da nova; um teste mostrou isso. O caso é raro (exige a partida voltar para a fila e ser reservada de novo no mesmo segundo, por exemplo depois de uma correção de ID na etapa 5), mas o custo de evitar é uma coluna. As outras colunas de horário continuam em segundos, cortados antes de gravar, porque o MySQL arredonda a fração |
| **Erro do nosso lado numa partida** (defeito, deadlock, gravação recusada pelo MySQL): fica no log, a transação desfaz o que tinha feito e a partida **volta para a fila em 1 intervalo, sem contar tentativa**; as outras do lote seguem | Deixar a partida presa até a recuperação (2 min) | A partida ficaria parada à toa; esperar um intervalo evita que um defeito que se repete vire consulta a cada rodada |
| **Erro na rodada inteira** (MySQL fora do ar): fica no log e o job tenta de novo na próxima rodada | Parar o job | O job não pode morrer por uma queda passageira; um teste derruba o banco e confere que o job continua acordando |
| **Partida presa** (em consulta há mais de `CONFERENCIA_PRESA_APOS_MS`, padrão 2 min) volta para a fila **sem contar tentativa**, com o motivo "consulta interrompida" | Contar como falha | A falha foi do sistema, não do site; contar faria a espera crescer sem o site ter falhado |
| (mesma) A API **não sobe** se esse tempo não passar do tempo limite da consulta | Valor livre | Abaixo do tempo limite, uma consulta lenta, mas viva, seria "tomada" e feita duas vezes |
| A espera até a próxima tentativa conta **do início da tentativa** | Do fim | É o horário que a tela vai mostrar como "última tentativa às X, próxima às Y" |
| A reserva atualiza **uma partida por vez, pela chave** | `UPDATE ... WHERE id IN (...)` | O teste do SKIP LOCKED mostrou: com quase a tabela toda na lista, o MySQL varre a tabela e **espera as linhas travadas por outra execução**, o que o SKIP LOCKED tinha acabado de evitar |
| Ao gravar uma partida encontrada, o job trava **primeiro o torneio** (trava compartilhada), na mesma ordem da importação: torneio → partidas → participações | Travar só a partida | Na ordem inversa, uma planilha substituída no meio da gravação causava **deadlock** (visto nos testes, 1 em 3 execuções). A trava compartilhada não faz as gravações do job esperarem umas pelas outras |
| **Sem apagar participações** antes de gravar | `DELETE` por segurança | O `DELETE` sem linhas trava o intervalo vazio do índice e causava deadlock entre gravações em paralelo. Não há o que apagar: uma partida conferida só volta para a fila pela correção do ID (etapa 5), que apaga as participações dela |
| `participacoes` **sem coluna `venceu`** | Repetir o vencedor em cada jogador, como no rascunho do banco | O vencedor já está na partida; repetir permitiria os dois discordarem |
| Os testes de integração usam o **site simulado de verdade**, sem demora, dentro do teste | Um site falso só para o teste | Testa o contrato real, inclusive as falhas programadas de novembro |
| Partida encontrada vira **"conferida" mesmo com times diferentes** | Comparar já no 4b | A comparação com a planilha (e o status `times_diferentes`) é da etapa 5 |

---

## Tela de progresso e "tentar agora" (etapa 4c), 14/10/2026

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| A tela **consulta a API a cada 5 s enquanto houver partida aguardando ou em consulta**, para sozinha quando não há mais, e para ao sair da página | Consultar sempre; ou atualização em tempo real (WebSocket, SSE) | Consultar sempre gastaria pedidos à toa depois do fim. O tempo real seria mais uma peça (conexão aberta, reconexão) para algo que muda a cada 2 a 10 s |
| A sondagem usa **`setTimeout` encadeado**: a próxima consulta só é marcada quando a anterior volta. A API fora do ar não para a sondagem; a tela mantém os dados e avisa "sem conexão" | `setInterval` | Com a API lenta, o `setInterval` empilharia consultas uma em cima da outra |
| Não encontrada e times diferentes **não mantêm a sondagem ligada** | Acompanhar enquanto houver qualquer partida não conferida | Elas dependem da Maria (correção do ID, etapa 5), não do site: esperar não muda nada |
| **"Tentar agora" por torneio**: a próxima tentativa das partidas "aguardando" passa a ser agora; o job pega na próxima vez que acordar (até 5 s) | Consultar o site direto na requisição do botão | Seria uma consulta paralela à do job, com risco de a mesma partida ser consultada duas vezes (D10) |
| (mesma) **Não zera as tentativas** | Recomeçar a agenda em 1 min | Se falhar de novo, segue de onde estava (um teste mostra a 3ª falha esperando 5 min). Zerar faria o botão desfazer o intervalo crescente |
| (mesma) **As em consulta não são tocadas** | — | Nada em paralelo: elas já estão sendo consultadas |
| **Bloqueio de 30 s guardado no banco** (`torneios.tentar_agora_em`, migration 007), com o torneio travado (`SELECT ... FOR UPDATE`) | Bloqueio na memória da API | Na memória, uma API reiniciada liberaria o botão, e duas APIs teriam dois bloqueios. A trava do torneio faz dois cliques ao mesmo tempo resultarem em um 200 e um 429 |
| Durante o bloqueio, **429** com `Retry-After` e os segundos que faltam; a API manda os segundos também no `GET` do torneio, e a tela conta a partir daí | A tela calcular pelo horário do clique | O relógio do navegador pode estar diferente do servidor; segundos relativos não dependem disso |
| Sem partida aguardando: **409, e o bloqueio não começa**. Depois do cálculo: 409 | Aceitar sem fazer nada | Um clique que não fez nada não deveria travar o próximo |
| **De quem foi o erro** numa coluna própria (`partidas.origem_do_erro`: `site` ou `interno`, migration 007). Interno = defeito nosso ou consulta interrompida (partida presa) | Descobrir pelo texto da mensagem | Mudar o texto de uma mensagem quebraria o selo sem ninguém perceber |
| Erro interno aparece na aba "Aguardando o site" com o selo **"Erro interno, não é o site"**; o "tentar agora" também vale para essas partidas | Esconder da Maria | Ela precisa saber que a demora não é do site, sem precisar entender o motivo técnico |
| Abas desta etapa: **"Aguardando o site"** e **"Todas as partidas"**; a tela abre na primeira enquanto houver partida lá | As três abas da D17 já agora | "Conferidas" e "Pendências" dependem da comparação com a planilha (etapa 5); até lá, "Todas as partidas" mostra também as não encontradas, que não podem sumir da tela. Na etapa 5, ela vira "Conferidas" e "Pendências" |

**Testado no navegador de verdade** (roteiro pelo protocolo de depuração do Edge, contra o Docker), mas **sem teste de componente no repositório**, pelo mesmo corte da etapa 3c. Os casos:
- com o site derrubado, a aba mostra a falha, o motivo e "última às X, próxima às Y";
- uma partida com erro interno aparece com o selo certo;
- o "tentar agora" antecipa as 15 partidas e a contagem desce de 30 s;
- ao religar o site, a tela chega a "15 de 15" sozinha e **para de consultar a API**;
- ao sair da página, nenhuma consulta continua.

As regras da tela (progresso, botão, textos da fila, sondagem) têm testes no Vitest do web.

---

## Base visual e nova lista de torneios, 14/10/2026

Só front, sem regra de negócio nova e sem mudar a API.

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| **Tokens visuais definidos uma vez** em `web/src/estilos.css` (cores, fontes, tamanhos de texto, espaçamentos de 4 em 4 px, raios, sombras, foco, alvo de toque de 44 px, larguras), tirados dos protótipos; as telas só usam as variáveis | Valores soltos em cada tela | A próxima tela (etapas 5 a 7) herda o visual sem copiar números, e trocar uma cor é mexer num lugar só |
| **Mono só para IDs de partida, nomes de arquivo e dinheiro**; números em selos, contadores, percentuais e datas usam a Sans com algarismos de mesma largura (`tabular-nums`) | Mono para todo número, como no protótipo | O zero da IBM Plex Mono tem um ponto no meio; em 12 px, "100%" parecia riscado |
| **No celular, as tabelas viram blocos** (cada célula com o nome da coluna ao lado); filtros, abas e botões ocupam a largura | Rolagem lateral dentro do cartão | A regra é não haver rolagem lateral. Conferido em 375 px nas três telas: a página não passa da largura da tela |
| **Foco visível** com contorno de 3 px (`outline`) em tudo que recebe o teclado; no cartão do modo de divisão, o cartão inteiro mostra o foco do rádio | Só o padrão do navegador | O padrão some sobre alguns fundos; o `outline` acompanha o arredondamento de cada elemento |
| O "Remover" posição **não aparece** com uma posição só | Botão desabilitado | Um botão que nunca pode ser usado é ruído |
| **Testes de componente** (`@vue/test-utils` com `happy-dom`) para o comportamento das telas: o "Remover", a data, os filtros e a busca da lista | Só regras puras | Reduz o corte registrado na 3c: estes comportamentos estão na tela, não numa função. `happy-dom` 20.14.5, e não a 21, que tinha poucos dias de publicada |
| A lista é de **cartões**, como no protótipo: a "coluna" de data de criação virou "Criado em dd/mm/aaaa" em cada cartão | Manter a tabela | O protótipo novo é de cartões; a data aparece no mesmo lugar em todos |
| Resumo, filtros (todos, em andamento, calculados) e busca **calculados na tela**, com o que o `GET /torneios` já devolve; a busca ignora maiúsculas e acentos | Filtrar na API | Poucos torneios; filtrar na tela evita mudar a API agora |

**Ficou de fora do protótipo da lista, por depender das etapas 5 a 7 ou de dados que a API ainda não devolve:**
- o cartão **"Precisam da sua atenção"** (conta pendências: etapa 5);
- a **régua de etapas** (Planilha, Conferência, Pendências, Cálculo): o status do torneio ainda não avança com a conferência, então a régua mostraria "Conferência" mesmo com tudo conferido (etapas 5 e 6);
- a **linha de detalhe** de cada torneio ("9 de 15 conferidas · próxima consulta às…", "3 diferenças aguardam o seu Ciente", "Calculado em… · 21 jogadores premiados"): o `GET /torneios` não traz o progresso de cada um, e as pendências e o cálculo são das etapas 5 e 6;
- as ações **"Revisar"** (etapa 5) e **"Ver resultado"** (etapa 6): hoje os cartões dizem "Subir planilha", "Acompanhar" ou "Abrir";
- **excluir torneio**, o cadeado dos calculados e a nota de torneios travados: melhoria pendente no `plano.md` (seção 9).

O cartão "Prêmios calculados" está na tela, com o que a API já tem (status e prêmio), e mostra R$ 0,00 até a etapa 6.

---

## Pendências e Ciente (etapa 5a), 15/10/2026

Só API, sem tela.

| Decisão | Alternativa descartada | Por que descartada |
|---|---|---|
| **As pendências não são gravadas:** saem sempre da comparação atual (`compararComSite`, D19) entre `linhas_planilha` e o que o job gravou do site (`partidas` + `participacoes`). **Só o Ciente é gravado** (tabela `cientes`, migration 008), pela chave da pendência | Tabela `pendencias` gerada na conferência, como no rascunho do banco | Uma cópia gravada fica desatualizada quando algo muda (correção de ID, nova consulta) e precisaria ser regenerada, levando os Cientes junto sem errar. Calcular na hora é sempre o estado atual; para 15 a 28 partidas, custa milissegundos |
| **O Ciente vale para a pendência exata**, identificada por uma **chave**: tipo, partida, jogador, campo e os dois valores (planilha e site). Se algum valor muda, a chave muda e o Ciente antigo não se aplica | Ciente por partida, ou por tipo e jogador | Um Ciente dado a "18 × 8 kills" não pode valer para "18 × 9": a Maria não viu esse valor |
| Itens do torneio todo (jogador em dois times, nome de time) usam a **lista de partidas**, ordenada, no lugar da partida | Deixar a partida vazia na chave | Se o jogador aparecer em mais uma partida, é outra situação: o Ciente precisa ser dado de novo |
| **A mensagem fica fora da chave** | Usar a mensagem | Reescrever uma frase no código apagaria os Cientes já dados |
| A chave é o **SHA-256** dos campos em JSON, com a **versão do formato** na frente | Os campos em texto, separados por um caractere | O JSON não confunde campos vizinhos ("a\|b" + "c" ≠ "a" + "b\|c"); o tamanho fixo (64) cabe num índice único; a versão permite mudar o formato sem confundir chaves antigas |
| **Bloqueantes** (não encontrada, times diferentes) não aceitam Ciente: **409**; se resolvem corrigindo o ID (5b). As **não bloqueantes** aceitam Ciente, mas **também seguram o cálculo** enquanto não o recebem (D17) | — | "Não bloqueante" quer dizer "não precisa de correção", e não "não segura o cálculo" |
| Marcar o Ciente de novo **não muda nada** (vale a hora do primeiro); desfazer o que não tem Ciente também não é erro | Responder erro | Dois cliques, ou duas abas, não podem dar erro na tela |
| Ciente numa chave que **não é de nenhuma pendência atual**: **404** "os dados mudaram, atualize a lista" | Aceitar e gravar | Seria um Ciente dado a algo que a Maria não está vendo |
| Ciente, desfazer e Ciente de todas **travam o torneio** (`SELECT ... FOR UPDATE`) | Sem trava | Um Ciente não pode correr junto com uma planilha nova (D22) nem com o cálculo |
| **Planilha nova (D22) apaga os Cientes** do torneio | Manter os que coincidirem | A D22 diz que a conferência recomeça do zero; um Ciente da planilha antiga não é um Ciente da nova |
| Os **dois times do site** são os times dos jogadores em `participacoes`, na ordem em que aparecem | Uma migration para guardar os times da resposta do site | No formato do site, todo jogador é de um dos dois times da partida; dá o mesmo resultado sem mais uma coluna |
| As linhas são comparadas com o **ID atual** da partida (pela chave `partida_id`) | O ID digitado em cada linha | Quando a Maria corrigir o ID (5b), as linhas vão junto com a partida |

**Comportamento esperado:** um Ciente cuja pendência mudou fica guardado, sem efeito. Se os valores voltarem exatamente aos de antes, ele volta a valer, porque é a mesma pendência que a Maria já viu.

---

## Stack e ferramentas

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Node.js + TypeScript, Vue, MySQL | — | Stack da PowerRev; detalhes na seção 16 do `contexto.md` |
| Conferência por tabela de tarefas no MySQL (`SELECT ... FOR UPDATE SKIP LOCKED`) | Fila no Redis (BullMQ) | Mais um serviço e um processo sem ganho real para 15 a 28 partidas; o worker fica atrás de uma interface, trocável depois |
| Express, Knex, Zod, Vitest | ORM completo (Prisma, TypeORM) | Knex deixa o SQL visível e permite SQL puro quando preciso |
| Monorepo com npm workspaces | Turborepo, pnpm, Nx | Três pacotes pequenos não justificam uma ferramenta a mais |
| MySQL 8.4 (versão LTS) | MySQL 8.0 | Ambas têm `SKIP LOCKED`; a 8.4 é a linha com suporte longo |
| Vitest 5 | Vitest 3 | O Vitest 3 vinha com 3 vulnerabilidades no `npm audit` (2 críticas, no `tinypool`). Em projeto novo, melhor começar na versão sem alertas |
| A API aplica as migrations ao subir | Passo manual de migração antes de subir | `docker compose up` deixa tudo pronto num comando só. Se a migration falhar, a API não sobe e o erro aparece no log |
| A rota `/saude` recebe a verificação do banco por parâmetro | Importar a conexão direto na rota | Permite testar a rota sem MySQL, inclusive o caso de banco fora do ar (503) |
| Front servido por `vite preview` com proxy `/api` | nginx | Serve o build de produção e repassa `/api` para a API sem CORS, com uma peça a menos. nginx fica como evolução se houver deploy real |
