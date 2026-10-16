# Decisões

Versão curta. Cada linha diz **o que foi decidido** e **por quê**, em uma frase.
O histórico completo (alternativas descartadas, testes, datas) está em `decisoes-detalhado.md`. As regras D1 a D24 estão na seção 11 do `contexto.md`.

---

## 1. Princípios

Quase todas as decisões saem destes cinco:

1. **O site oficial é a verdade.** Vencedor, jogadores, minutos e kills vêm do site. A planilha só diz quais partidas consultar.
2. **Nada é pago sem a Maria ter visto.** Toda diferença pede "Ciente" ou correção antes do cálculo.
3. **Dinheiro em centavos inteiros, sem float**, com uma única regra de arredondamento.
4. **Depois do cálculo, nada muda.** O resultado é congelado e nunca recalculado.
5. **A Maria não é técnica.** Toda mensagem diz o que fazer e onde (linha do Excel, campo, aba).

---

## 2. Regras de negócio

| Tema | Decisão | Por quê |
|---|---|---|
| Fonte dos dados (D3, D4) | Diferença de minutos, kills, vencedor ou jogador: usa o site e pede "Ciente". Planilha zerada ou vazia: vale o site | Se o site é a verdade, não há escolha a fazer; o Ciente garante que ela viu |
| Partida não encontrada / times diferentes (D5) | Bloqueia. A única saída é **corrigir o ID** | Indica que a partida certa nem foi consultada |
| O que a Maria edita (D16) | **Só o ID da partida.** Nunca minutos, kills ou resultado | Erro de digitação viraria Pix errado |
| Duplicata, nick com caixa diferente (D6, D7) | Aviso com Ciente, não bloqueia | O cálculo usa o site, onde o jogador aparece uma vez |
| Data e rodada diferentes (D19) | Não geram pendência | Não mudam o dinheiro |
| Pendências (D17) | Três abas: Conferidas, Pendências, Aguardando o site. Cada problema aparece em um lugar só | Um problema em dois lugares seria resolvido duas vezes |
| Liberar o cálculo (D17) | Só com: todas conferidas, nenhum bloqueio, todo aviso com Ciente | Princípio 2 |
| "Ciente de todas" | Só libera quando nenhuma partida aguarda o site | Senão, uma pendência nova chegaria com Ciente sem ela ver |
| Arredondamento (D9, D20, D24) | **Maior resto**: parte inteira em centavos, o que sobra vai para a maior fração. Empate: alfabética (jogadores, times) ou melhor colocada (posições) | O centavo vai para quem mais perdeu no corte (Tuca: R$ 65,90, não Corvinho: R$ 600,01) |
| Ordem alfabética | De dicionário: ignora acentos e maiúsculas | "Águias" antes de "Ursos" |
| Classificação (D2) | Vitórias → kills do time → empate total divide igual. Posição compartilhada (1, 2, 3, 3, 5) | Critério visível na página pública |
| Percentuais (D20) | Precisam somar 100% | O anunciado é exatamente o pago |
| Menos times que posições (D24) | O valor das posições vazias é dividido igualmente entre todos os times | Nenhum dinheiro fica sem dono |
| Minutos ou kills (D1, D21) | Escolhido na criação, sem rota para mudar. No modo kills, 0 kills = R$ 0; time sem kills divide por minutos | Aviso das consequências aparece na criação |
| Jogador em dois times (D13) | Uma linha de prêmio por time | Cada time paga a parte dele |
| Planilha nova (D22) | Substitui a anterior inteira e apaga os Cientes. Depois do cálculo: 409 | Não misturar conferência antiga com planilha nova |
| Remover torneio | Só antes do cálculo | O resultado é o registro do pagamento |

---

## 3. Leitura da planilha (D18)

**Tolerante na forma, rígida no conteúdo.**

- Aceita: Windows-1252 (converte e avisa), cabeçalho com outra caixa/acentos/ordem, data `d/m/aaaa`, ID sem `#`, `Venceu?` = sim/não/nao.
- Recusa: minutos ou kills vazios, data impossível, ano fora de 2000–2100, ID com letras, partida com 1 ou 3+ times (D23), `.xlsx` (frase pedindo "CSV UTF-8").
- Limites em `LIMITES` (`api/src/dominio/planilha.ts`): nick/time 80 caracteres (contados como o MySQL conta), ID 19 dígitos, minutos/kills até 100.000.
- **Junta todos os erros** com a linha do Excel e recusa o arquivo inteiro. Nunca importa pela metade.

---

## 4. Conferência com o site

| Decisão | Por quê |
|---|---|
| Tabela de tarefas no MySQL com `SELECT ... FOR UPDATE SKIP LOCKED`, sem Redis | Um serviço a menos para 15 a 28 partidas |
| Job dentro do processo da API, isolado em `conferencia/` | Virar processo separado é só um arquivo de entrada novo |
| Lote de 3 consultas em paralelo | Equilíbrio entre velocidade e um site instável |
| Reserva numa transação curta; consulta fora dela | Não segurar conexão do banco por até 15 s |
| `em_consulta_desde` (`DATETIME(3)`) funciona como **recibo**: só grava se a reserva ainda for a mesma | Descarta resultado velho (ID corrigido, planilha trocada, torneio removido) |
| Só o 404 é definitivo. 503, timeout, erro de rede, outro código ou resposta fora do formato: tenta de novo em 1, 2, 5, 10 min, **sem limite** | Toda partida precisa ser conferida (D5) |
| Resposta validada com Zod **e** coerência (vencedor é um dos times, todo jogador num dos times etc.) | Dado incoerente travaria o cálculo sem saída para a Maria |
| Timeout de 15 s cobre a resposta inteira; a API não sobe se ele for menor que a demora máxima do site | Evita consulta pendurada e falsos timeouts |
| Partida presa > 2 min volta para a fila sem contar tentativa | A falha foi nossa, não do site |
| `origem_do_erro` (`site` / `interno`) em coluna própria | A tela mostra "Erro interno, não é o site" sem depender do texto |
| "Tentar agora" só antecipa a fila; bloqueio de 30 s gravado no banco | Nada de consulta paralela à do job |

**Ordem das travas, em toda gravação:** torneio → partidas → participações. Inverter causou deadlock nos testes.

---

## 5. Banco e API

- **Collation `utf8mb4_0900_as_cs`** em nick, time e ID: o padrão juntaria "Falcoes" e "Falcões" em silêncio. Códigos de acesso em `utf8mb4_bin`.
- **Pendências não são gravadas**: saem na hora da comparação. **Só o Ciente é gravado**, por uma chave SHA-256 (tipo, partida, jogador, campo e os dois valores). Se um valor muda, o Ciente antigo não vale.
- **"Pode calcular"** também é calculado na hora (`calculo` no `GET /torneios/:id`), e conferido de novo dentro da transação do cálculo.
- **Resultado congelado** em `calculos`, `premios_time` e `premios_jogador`, com a configuração usada. Leituras nunca recalculam.
- DATE volta como texto `aaaa-mm-dd`; sessão do MySQL fixada em UTC; um relógio só (o da API) para tentativas.
- Migration aplicada nunca é editada; a API aplica as migrations ao subir.
- Repositórios recebem o executor (conexão ou transação).

---

## 6. Acesso e transparência (D11, R3)

| Quem | Como entra | O que vê |
|---|---|---|
| Maria | Senha única `ADMIN_SENHA` em `Authorization: Bearer` | Tudo |
| Qualquer pessoa | Link público `/publico/:codigo` | Classificação e regras, **sem valores individuais** |
| Time premiado | Link `/time/:codigo` | Extrato dos jogadores daquele time, nada de outros times |

- Códigos: 32 caracteres (`crypto.randomBytes(24)`, base64url), gerados no cálculo, guardados em texto para a Maria copiar de novo.
- Qualquer erro em `/publico` e `/time` dá o mesmo 404. Tudo com `noindex`.
- Rotas abertas montadas antes do middleware; **todo o resto pede senha**, inclusive rota inexistente (401).
- Senha comparada com `timingSafeEqual` sobre SHA-256; guardada no `sessionStorage`.

---

## 7. CSV

UTF-8 com BOM, separador `;`, CRLF, valor `1000,00` (sem milhar), ordem por posição → valor → nick, coluna "Pago" vazia no fim, sem linha de total. Células que começam com `= + - @ \t \r` ganham apóstrofo (injeção de fórmula).

---

## 8. Stack

Node + TypeScript, Express, Knex (sem ORM), Zod, Vitest, Vue 3 + vue-router 4, MySQL 8.4, npm workspaces. Front servido por `vite preview` com proxy `/api`. Fontes empacotadas (funciona sem internet).

---

## 9. Fora do escopo

| O quê | Por quê |
|---|---|
| Pix automático, bot do Discord | Pix errado não volta (D12). A Maria paga pelo CSV |
| Login completo, limite de tentativas, HTTPS, deploy | Projeto à parte; a senha única fecha o furo principal |
| Ajuste manual quando o site errar | Pede auditoria separada do dado do site |
| Time/nick escrito de dois jeitos pelo site | Precisa de regra de negócio (bloquear ou unificar) |
| Pool de consultas no lugar do lote de 3 | Vazão, não defeito |
| PDF, "jogou X de Y", "Pago" por jogador, "Gerar novo link", "Arquivar", e-mail | Comodidades, sem regra nova |
| Limpar status sem uso (`conferindo`, `pronto`, `times_diferentes`) | Só limpeza; exige migration |

## 10. Limitações conhecidas

- Senha única: sem usuários, sem registro de quem fez o quê, sem limite de tentativas.
- Sem HTTPS: a senha viaja aberta.
- Se o site oficial errar, não há como corrigir à mão.
- Reiniciar a API pausa a conferência (partidas presas voltam sozinhas).
