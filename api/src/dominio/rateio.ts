import type { PartidaSite } from './comparacao';
import { dividirMaiorResto, SomaDosPesosZero } from './divisao';
import { ErroDeRegra } from './erro-de-regra';
import type { PremioTime } from './premio';
import { compararAlfabetico } from './texto';

export type ModoDivisao = 'minutos' | 'kills';

export interface PremioJogador {
  time: string;
  nick: string;
  base: number;
  baseTime: number;
  baseUsada: ModoDivisao;
  premioCentavos: number;
  recebeuCentavo: boolean;
  explicacao: string | null;
}

const SEM_KILLS = 'Ninguém do time fez kills; o prêmio foi dividido pelos minutos jogados.';

export function ratearEntreJogadores(
  premios: PremioTime[],
  partidas: PartidaSite[],
  modo: ModoDivisao,
): PremioJogador[] {
  const resultado: PremioJogador[] = [];

  for (const { time, premioCentavos } of premios) {
    if (premioCentavos === 0) continue;

    const jogadores = somarPorJogador(partidas, time);
    let baseUsada = modo;
    let explicacao: string | null = null;
    if (modo === 'kills' && jogadores.every((j) => j.kills === 0)) {
      baseUsada = 'minutos';
      explicacao = SEM_KILLS;
    }

    const participantes = jogadores.map((j) => ({ nome: j.nick, peso: j[baseUsada] }));
    const baseTime = participantes.reduce((soma, p) => soma + p.peso, 0);
    let partes;
    try {
      partes = dividirMaiorResto(premioCentavos, participantes);
    } catch (erro) {
      if (!(erro instanceof SomaDosPesosZero)) throw erro;
      throw new ErroDeRegra(`O time ${time} tem prêmio, mas nenhum minuto nem kill registrado no site: não há como dividir.`);
    }

    partes.forEach((parte, i) => {
      resultado.push({
        time,
        nick: parte.nome,
        base: participantes[i].peso,
        baseTime,
        baseUsada,
        premioCentavos: parte.valor,
        recebeuCentavo: parte.recebeuCentavo,
        explicacao,
      });
    });
  }
  return resultado;
}

function somarPorJogador(partidas: PartidaSite[], time: string) {
  const porNick = new Map<string, { nick: string; minutos: number; kills: number }>();
  for (const partida of partidas) {
    for (const j of partida.jogadores) {
      if (j.time !== time) continue;
      const soma = porNick.get(j.nick) ?? { nick: j.nick, minutos: 0, kills: 0 };
      soma.minutos += j.minutos;
      soma.kills += j.kills;
      porNick.set(j.nick, soma);
    }
  }
  return [...porNick.values()].sort((a, b) => compararAlfabetico(a.nick, b.nick));
}
