import type { JogadorDaPaginaDoTime, PaginaDoTime } from '../servicos/api';
import { formatarCentavos } from './dinheiro';
import { juntarComE, normalizar } from './resultado';

const ARREDONDAMENTO = 'Os valores são arredondados para o centavo. O centavo que sobra vai para quem estava mais perto de recebê-lo.';

const formatarPercentual = (centesimos: number) => `${Math.floor(centesimos / 100)},${String(centesimos % 100).padStart(2, '0')}%`;

function passoDoPremio({ comoFoiCalculado: c, time }: PaginaDoTime): string {
  const premio = `O prêmio do torneio é ${formatarCentavos(c.premioTotalCentavos)}.`;
  if (c.percentualDaPosicao === 0) return `${premio} O prêmio do time ficou em ${formatarCentavos(time.premioCentavos)}.`;
  const posicao = `${premio} O ${time.posicao}º lugar leva ${c.percentualDaPosicao}%`;
  if (c.empate) return `${posicao}.`;
  const valorDaPosicao = Math.floor((c.premioTotalCentavos * c.percentualDaPosicao) / 100);
  if (time.premioCentavos === valorDaPosicao || time.premioCentavos === valorDaPosicao + 1) return `${posicao}: ${formatarCentavos(time.premioCentavos)}.`;
  return `${posicao}. O torneio teve menos times do que posições premiadas: o valor das posições sem time foi dividido igualmente entre todos os times, e o prêmio do time ficou em ${formatarCentavos(time.premioCentavos)}.`;
}

function passoDoCriterio({ comoFoiCalculado: c, time }: PaginaDoTime): string | null {
  if (c.empate) {
    const outros = c.empate.quantidadeDeTimes - 1;
    const posicoes = juntarComE(c.empate.posicoes.map((p) => `do ${p}º`));
    const percentuais = juntarComE(c.empate.percentuais.map((p) => `${p}%`));
    return `${time.nome} empatou em vitórias e em kills com mais ${outros} ${outros === 1 ? 'time' : 'times'}: `
      + `os prêmios ${posicoes} lugar (${percentuais}) foram somados e divididos igualmente entre os ${c.empate.quantidadeDeTimes} times. `
      + `O prêmio do time ficou em ${formatarCentavos(time.premioCentavos)}.`;
  }
  if (c.criterio === 'desempate por kills do time') return `Houve empate em vitórias; o desempate foi pelas kills do time, e ${time.nome} ficou em ${time.posicao}º.`;
  return null;
}

function passoDaDivisao({ comoFoiCalculado: c, time }: PaginaDoTime): string {
  if (c.modoDivisao === 'kills' && time.baseUsada === 'minutos') {
    return 'O torneio divide pelas kills, mas ninguém do time fez kills: o prêmio do time foi dividido pelos minutos que cada um jogou.';
  }
  const como = time.baseUsada === 'kills' ? 'pelas kills de cada um' : 'pelos minutos que cada um jogou';
  return `Dentro do time, o valor é dividido ${como}, conforme o registro oficial de cada partida.`;
}

export function passosDoCalculo(pagina: PaginaDoTime): string[] {
  return [passoDoPremio(pagina), passoDoCriterio(pagina), passoDaDivisao(pagina), ARREDONDAMENTO].filter((p): p is string => p !== null);
}

export function contaDoJogador(j: JogadorDaPaginaDoTime, time: PaginaDoTime['time']): string {
  const unidade = j.baseUsada === 'kills' ? 'kills' : 'minutos';
  return `${j.base} de ${time.baseTime} ${unidade} (${formatarPercentual(j.centesimosDePercentual)}) × ${formatarCentavos(time.premioCentavos)}`;
}

export function filtrarPorNick(jogadores: JogadorDaPaginaDoTime[], busca: string): JogadorDaPaginaDoTime[] {
  const procurado = normalizar(busca);
  return procurado ? jogadores.filter((j) => normalizar(j.nick).includes(procurado)) : jogadores;
}

export function enderecoDoLink(origem: string, tipo: 'publico' | 'time', codigo: string): string {
  return `${origem}/${tipo}/${encodeURIComponent(codigo)}`;
}
