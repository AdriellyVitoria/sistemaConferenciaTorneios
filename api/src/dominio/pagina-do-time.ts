/**
 * A página do link de um time premiado (D11, etapa 7b): o extrato de cada jogador DESTE time,
 * com a conta, para responder "por que eu recebi só isso?" sem a Maria precisar explicar.
 *
 * Só do resultado congelado (6a), nada é recalculado. Nada de outros times: nem nicks, nem
 * nomes. Do empate, só quantos times dividiram e quais posições foram somadas. Quem quiser ver
 * os outros times tem o link da página pública (o código público vem junto).
 */

import { compararAlfabetico } from './texto';
import type { ModoDivisao } from './rateio';

/** O critério gravado quando o prêmio de posições empatadas foi somado e dividido (D2). */
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

/** O que a página usa do resultado gravado (o ResultadoGravado do repositório tem isso e mais). */
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
  /** Minutos ou kills, conforme `baseUsada` (no modo kills, um time sem kills divide pelos minutos, D21). */
  base: number;
  baseUsada: ModoDivisao;
  /** A parte do jogador no time, em centésimos de ponto percentual: 220 = 2,20%. Só inteiros. */
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
    /** O percentual da posição do time (0 se a posição não paga). */
    percentualDaPosicao: number;
    criterio: string | null;
    /** Só no empate dividido: as posições somadas, os percentuais delas e quantos times dividiram. */
    empate: { posicoes: number[]; percentuais: number[]; quantidadeDeTimes: number } | null;
    modoDivisao: ModoDivisao;
  };
  jogadores: JogadorDaPaginaDoTime[];
  totalCentavos: number;
  codigoPublico: string;
}

/** base / baseTime em centésimos de ponto percentual, arredondado para o mais próximo, só com inteiros. */
export function centesimosDePercentual(base: number, baseTime: number): number {
  if (baseTime === 0) return 0;
  return Math.floor((base * 20_000 + baseTime) / (2 * baseTime));
}

const percentualDa = (percentuais: number[], posicao: number) => percentuais[posicao - 1] ?? 0;

/** A página do time, ou null se o time não está no resultado ou não teve prêmio (sem link, D11). */
export function montarPaginaDoTime(nomeDoTorneio: string, resultado: ResultadoDoTime, nomeDoTime: string, codigoPublico: string): PaginaDoTime | null {
  const time = resultado.times.find((t) => t.time === nomeDoTime);
  if (!time || time.premioCentavos === 0) return null;

  const jogadores = resultado.jogadores
    .filter((j) => j.time === nomeDoTime)
    // quem recebe mais primeiro; no mesmo valor, pelo nick
    .sort((a, b) => b.premioCentavos - a.premioCentavos || compararAlfabetico(a.nick, b.nick));
  // a base do time e a usada são as mesmas para todos os jogadores do time
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
