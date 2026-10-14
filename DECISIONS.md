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
