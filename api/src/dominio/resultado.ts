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
  minutos: number;
  kills: number;
}

export interface Resultado {
  times: PremioTime[];
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
