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
import { compararAlfabetico } from './texto';

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
  /**
   * Todos os jogadores, um por time em que jogou: os dos times premiados com o rateio, e os dos
   * times sem prêmio com R$ 0 e os números deles (6b), para o filtro por nick e para responder
   * "por que meu time não ganhou?" com o que estava no cálculo.
   */
  jogadores: JogadorDoResultado[];
}

export function montarResultado({ partidas, premioCentavos, percentuais, modoDivisao }: EntradaDoResultado): Resultado {
  const times = premiarTimes(classificar(partidas), premioCentavos, percentuais);
  const totais = totaisPorJogador(partidas);
  const rateados = ratearEntreJogadores(times, partidas, modoDivisao);

  const jogadores: JogadorDoResultado[] = [];
  for (const time of times) {
    if (time.premioCentavos > 0) {
      for (const j of rateados.filter((r) => r.time === time.time)) {
        const { minutos, kills } = totais.get(chave(j.time, j.nick))!;
        jogadores.push({ ...j, minutos, kills });
      }
      continue;
    }
    // time sem prêmio: os jogadores entram com R$ 0, com a base do modo do torneio
    const doTime = [...totais.entries()].filter(([k]) => k.startsWith(`${time.time}\u0000`)).map(([k, t]) => ({ nick: k.split('\u0000')[1], ...t }));
    const baseTime = doTime.reduce((soma, j) => soma + j[modoDivisao], 0);
    for (const j of doTime.sort((a, b) => compararAlfabetico(a.nick, b.nick))) {
      jogadores.push({
        time: time.time, nick: j.nick, minutos: j.minutos, kills: j.kills,
        base: j[modoDivisao], baseTime, baseUsada: modoDivisao,
        premioCentavos: 0, recebeuCentavo: false, explicacao: null,
      });
    }
  }
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
