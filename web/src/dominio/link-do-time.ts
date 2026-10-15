/**
 * Regras da tela do link do time (7d), sem Vue nem HTTP. Tudo sai do que a API manda em
 * GET /time/:codigo, que vem do resultado congelado: nada de dinheiro é recalculado, e nada aqui
 * cita outros times (do empate, só quantos times dividiram e quais posições foram somadas).
 */

import type { JogadorDaPaginaDoTime, PaginaDoTime } from '../servicos/api';
import { formatarCentavos } from './dinheiro';
import { juntarComE, normalizar } from './resultado';

const ARREDONDAMENTO = 'Os valores são arredondados para o centavo. O centavo que sobra vai para quem estava mais perto de recebê-lo.';

/** 2000 -> "20,00%": centésimos de ponto percentual, já arredondados pela API. */
const formatarPercentual = (centesimos: number) => `${Math.floor(centesimos / 100)},${String(centesimos % 100).padStart(2, '0')}%`;

/**
 * O primeiro passo: o prêmio do torneio e o percentual da posição. O valor da posição só aparece
 * quando é mesmo o prêmio do time: o percentual sobre o prêmio, cortado no centavo, ou um centavo a
 * mais (o maior resto entre as posições, D20). Se o time recebeu mais do que isso, o torneio teve
 * menos times do que posições premiadas (D24), e o passo explica.
 */
function passoDoPremio({ comoFoiCalculado: c, time }: PaginaDoTime): string {
  const premio = `O prêmio do torneio é ${formatarCentavos(c.premioTotalCentavos)}.`;
  if (c.percentualDaPosicao === 0) return `${premio} O prêmio do time ficou em ${formatarCentavos(time.premioCentavos)}.`;
  const posicao = `${premio} O ${time.posicao}º lugar leva ${c.percentualDaPosicao}%`;
  // no empate dividido, o valor do time vem no passo do critério
  if (c.empate) return `${posicao}.`;
  const valorDaPosicao = Math.floor((c.premioTotalCentavos * c.percentualDaPosicao) / 100);
  if (time.premioCentavos === valorDaPosicao || time.premioCentavos === valorDaPosicao + 1) return `${posicao}: ${formatarCentavos(time.premioCentavos)}.`;
  return `${posicao}. O torneio teve menos times do que posições premiadas: o valor das posições sem time foi dividido igualmente entre todos os times, e o prêmio do time ficou em ${formatarCentavos(time.premioCentavos)}.`;
}

/** O passo do critério de desempate (D2), ou null quando o time não empatou em vitórias. */
function passoDoCriterio({ comoFoiCalculado: c, time }: PaginaDoTime): string | null {
  if (c.empate) {
    const outros = c.empate.quantidadeDeTimes - 1;
    const posicoes = juntarComE(c.empate.posicoes.map((p) => `do ${p}º`));
    const percentuais = juntarComE(c.empate.percentuais.map((p) => `${p}%`));
    return `${time.nome} empatou em vitórias e em kills com mais ${outros} ${outros === 1 ? 'time' : 'times'}: `
      + `os prêmios ${posicoes} lugar (${percentuais}) foram somados e divididos igualmente entre os ${c.empate.quantidadeDeTimes} times. `
      + `O prêmio do time ficou em ${formatarCentavos(time.premioCentavos)}.`;
  }
  // todos os times do grupo recebem esse critério, quem ficou na frente e quem ficou atrás: a frase vale para os dois
  if (c.criterio === 'desempate por kills do time') return `Houve empate em vitórias; o desempate foi pelas kills do time, e ${time.nome} ficou em ${time.posicao}º.`;
  return null;
}

/** O passo da divisão dentro do time (D1), com o caso do time sem kills (D21). */
function passoDaDivisao({ comoFoiCalculado: c, time }: PaginaDoTime): string {
  if (c.modoDivisao === 'kills' && time.baseUsada === 'minutos') {
    return 'O torneio divide pelas kills, mas ninguém do time fez kills: o prêmio do time foi dividido pelos minutos que cada um jogou.';
  }
  const como = time.baseUsada === 'kills' ? 'pelas kills de cada um' : 'pelos minutos que cada um jogou';
  return `Dentro do time, o valor é dividido ${como}, conforme o registro oficial de cada partida.`;
}

/** "Como o valor foi calculado", um passo por item da lista. */
export function passosDoCalculo(pagina: PaginaDoTime): string[] {
  return [passoDoPremio(pagina), passoDoCriterio(pagina), passoDaDivisao(pagina), ARREDONDAMENTO].filter((p): p is string => p !== null);
}

/** "173 de 865 minutos (20,00%) × R$ 3.000,00" */
export function contaDoJogador(j: JogadorDaPaginaDoTime, time: PaginaDoTime['time']): string {
  const unidade = j.baseUsada === 'kills' ? 'kills' : 'minutos';
  return `${j.base} de ${time.baseTime} ${unidade} (${formatarPercentual(j.centesimosDePercentual)}) × ${formatarCentavos(time.premioCentavos)}`;
}

/** "Procurar meu nick": parcial, sem diferenciar maiúsculas e acentos ("tu" acha Tuca). */
export function filtrarPorNick(jogadores: JogadorDaPaginaDoTime[], busca: string): JogadorDaPaginaDoTime[] {
  const procurado = normalizar(busca);
  return procurado ? jogadores.filter((j) => normalizar(j.nick).includes(procurado)) : jogadores;
}

/** O endereço completo de um link, com a origem da própria tela ("http://localhost:5173"). */
export function enderecoDoLink(origem: string, tipo: 'publico' | 'time', codigo: string): string {
  return `${origem}/${tipo}/${encodeURIComponent(codigo)}`;
}
