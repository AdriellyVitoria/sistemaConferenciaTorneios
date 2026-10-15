/**
 * O resultado completo do torneio (etapa 6a). Função pura que junta as peças da etapa 1:
 * classificação (D2), prêmio por time (D20) e rateio entre os jogadores (D1, D8, D9, D13, D21).
 *
 * Recebe os dados oficiais do site (D3), já saídos da comparação: os nicks são os do site (D7),
 * e a linha duplicada da planilha não existe aqui (D6). Não lê banco nem rede.
 */

import { classificar } from './classificacao';
import type { PartidaSite } from './comparacao';
import { premiarTimes, type PremioTime } from './premio';
import { ratearEntreJogadores, type ModoDivisao, type PremioJogador } from './rateio';

export interface EntradaDoResultado {
  partidas: PartidaSite[];
  premioCentavos: number;
  percentuais: number[];
  modoDivisao: ModoDivisao;
}

export interface JogadorDoResultado extends PremioJogador {
  /** Minutos e kills do jogador somados nas partidas em que jogou POR ESTE time (D13). */
  minutos: number;
  kills: number;
}

export interface Resultado {
  /** Todos os times, na ordem da classificação; os sem prêmio com 0. */
  times: PremioTime[];
  /** Os jogadores dos times premiados, um por time em que jogou. */
  jogadores: JogadorDoResultado[];
}

export function montarResultado({ partidas, premioCentavos, percentuais, modoDivisao }: EntradaDoResultado): Resultado {
  const times = premiarTimes(classificar(partidas), premioCentavos, percentuais);
  const totais = totaisPorJogador(partidas);
  const jogadores = ratearEntreJogadores(times, partidas, modoDivisao).map((j) => {
    const { minutos, kills } = totais.get(chave(j.time, j.nick))!;
    return { ...j, minutos, kills };
  });
  return { times, jogadores };
}

const chave = (time: string, nick: string) => `${time}\u0000${nick}`;

/** Minutos e kills de cada jogador, por time: o extrato mostra os dois, qualquer que seja o modo. */
function totaisPorJogador(partidas: PartidaSite[]): Map<string, { minutos: number; kills: number }> {
  const totais = new Map<string, { minutos: number; kills: number }>();
  for (const partida of partidas) {
    for (const j of partida.jogadores) {
      const t = totais.get(chave(j.time, j.nick)) ?? { minutos: 0, kills: 0 };
      t.minutos += j.minutos;
      t.kills += j.kills;
      totais.set(chave(j.time, j.nick), t);
    }
  }
  return totais;
}
