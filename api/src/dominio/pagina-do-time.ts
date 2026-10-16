import { compararAlfabetico } from './texto';
import type { ModoDivisao } from './rateio';

const CRITERIO_DIVISAO_IGUAL = 'divisão igual (empate em vitórias e kills)';

interface TimeGravado {
  posicao: number;
  time: string;
  premioCentavos: number;
  criterio: string | null;
}

interface JogadorGravado {
  time: string;
  nick: string;
  base: number;
  baseTime: number;
  baseUsada: ModoDivisao;
  premioCentavos: number;
  recebeuCentavo: boolean;
  explicacao: string | null;
}

export interface ResultadoDoTime {
  calculadoEm: Date;
  premioCentavos: number;
  percentuais: number[];
  modoDivisao: ModoDivisao;
  times: TimeGravado[];
  jogadores: JogadorGravado[];
}

export interface JogadorDaPaginaDoTime {
  nick: string;
  base: number;
  baseUsada: ModoDivisao;
  centesimosDePercentual: number;
  premioCentavos: number;
  recebeuCentavo: boolean;
  explicacao: string | null;
}

export interface PaginaDoTime {
  torneio: { nome: string };
  calculadoEm: Date;
  time: { nome: string; posicao: number; premioCentavos: number; baseUsada: ModoDivisao; baseTime: number };
  comoFoiCalculado: {
    premioTotalCentavos: number;
    percentualDaPosicao: number;
    criterio: string | null;
    empate: { posicoes: number[]; percentuais: number[]; quantidadeDeTimes: number } | null;
    modoDivisao: ModoDivisao;
  };
  jogadores: JogadorDaPaginaDoTime[];
  totalCentavos: number;
  codigoPublico: string;
}

export function centesimosDePercentual(base: number, baseTime: number): number {
  if (baseTime === 0) return 0;
  return Math.floor((base * 20_000 + baseTime) / (2 * baseTime));
}

const percentualDa = (percentuais: number[], posicao: number) => percentuais[posicao - 1] ?? 0;

export function montarPaginaDoTime(nomeDoTorneio: string, resultado: ResultadoDoTime, nomeDoTime: string, codigoPublico: string): PaginaDoTime | null {
  const time = resultado.times.find((t) => t.time === nomeDoTime);
  if (!time || time.premioCentavos === 0) return null;

  const jogadores = resultado.jogadores
    .filter((j) => j.time === nomeDoTime)
    .sort((a, b) => b.premioCentavos - a.premioCentavos || compararAlfabetico(a.nick, b.nick));
  const { baseTime, baseUsada } = jogadores[0] ?? { baseTime: 0, baseUsada: resultado.modoDivisao };

  let empate: PaginaDoTime['comoFoiCalculado']['empate'] = null;
  if (time.criterio === CRITERIO_DIVISAO_IGUAL) {
    const quantidadeDeTimes = resultado.times.filter((t) => t.posicao === time.posicao).length;
    const posicoes = Array.from({ length: quantidadeDeTimes }, (_, i) => time.posicao + i);
    empate = { posicoes, percentuais: posicoes.map((p) => percentualDa(resultado.percentuais, p)), quantidadeDeTimes };
  }

  return {
    torneio: { nome: nomeDoTorneio },
    calculadoEm: resultado.calculadoEm,
    time: { nome: time.time, posicao: time.posicao, premioCentavos: time.premioCentavos, baseUsada, baseTime },
    comoFoiCalculado: {
      premioTotalCentavos: resultado.premioCentavos,
      percentualDaPosicao: percentualDa(resultado.percentuais, time.posicao),
      criterio: time.criterio,
      empate,
      modoDivisao: resultado.modoDivisao,
    },
    jogadores: jogadores.map((j) => ({
      nick: j.nick,
      base: j.base,
      baseUsada: j.baseUsada,
      centesimosDePercentual: centesimosDePercentual(j.base, j.baseTime),
      premioCentavos: j.premioCentavos,
      recebeuCentavo: j.recebeuCentavo,
      explicacao: j.explicacao,
    })),
    totalCentavos: jogadores.reduce((soma, j) => soma + j.premioCentavos, 0),
    codigoPublico,
  };
}
