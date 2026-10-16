import type { PartidaSite } from './comparacao';
import { compararAlfabetico } from './texto';

export type CriterioClassificacao = 'desempate por kills do time' | 'empate em vitórias e kills';

export interface ClassificacaoTime {
  posicao: number;
  time: string;
  vitorias: number;
  killsTime: number;
  criterio: CriterioClassificacao | null;
}

export function classificar(partidas: PartidaSite[]): ClassificacaoTime[] {
  const vitorias = new Map<string, number>();
  const kills = new Map<string, number>();

  for (const partida of partidas) {
    for (const time of partida.times) {
      if (!vitorias.has(time)) vitorias.set(time, 0);
      if (!kills.has(time)) kills.set(time, 0);
    }
    vitorias.set(partida.vencedor, (vitorias.get(partida.vencedor) ?? 0) + 1);
    for (const jogador of partida.jogadores) {
      kills.set(jogador.time, (kills.get(jogador.time) ?? 0) + jogador.kills);
    }
  }

  const times = [...vitorias.keys()].map((time) => ({
    time,
    vitorias: vitorias.get(time)!,
    killsTime: kills.get(time)!,
  }));

  times.sort((a, b) => b.vitorias - a.vitorias || b.killsTime - a.killsTime || compararAlfabetico(a.time, b.time));

  return times.map((t) => {
    const melhores = times.filter(
      (o) => o.vitorias > t.vitorias || (o.vitorias === t.vitorias && o.killsTime > t.killsTime),
    );
    const mesmasVitorias = times.filter((o) => o !== t && o.vitorias === t.vitorias);
    const criterio: CriterioClassificacao | null = mesmasVitorias.some((o) => o.killsTime === t.killsTime)
      ? 'empate em vitórias e kills'
      : mesmasVitorias.length > 0
        ? 'desempate por kills do time'
        : null;
    return { posicao: melhores.length + 1, ...t, criterio };
  });
}
