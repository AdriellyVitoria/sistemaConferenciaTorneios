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
