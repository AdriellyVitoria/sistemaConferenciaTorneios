/**
 * Rateio do prêmio de cada time entre os seus jogadores (etapa 1, parte 4c).
 *
 * Função pura: recebe o prêmio de cada time (4b), os dados oficiais do site e o modo de divisão,
 * e devolve o prêmio de cada jogador.
 * - Proporcional aos minutos ou às kills somados nas partidas em que o jogador jogou POR AQUELE
 *   time (D1). Jogador em dois times recebe separado em cada um (D13).
 * - Maior resto com o nick (D9): cada jogador sabe se recebeu centavo de arredondamento.
 * - Modo kills, time premiado sem nenhuma kill: divide pelos minutos e explica (D21).
 * - A soma de todos os jogadores é exatamente a soma dos prêmios dos times.
 */

import type { PartidaSite } from './comparacao';
import { dividirMaiorResto, SomaDosPesosZero } from './divisao';
import { ErroDeRegra } from './erro-de-regra';
import type { PremioTime } from './premio';
import { compararAlfabetico } from './texto';

export type ModoDivisao = 'minutos' | 'kills';

export interface PremioJogador {
  time: string;
  nick: string;
  /** Minutos (ou kills) do jogador pelo time: o peso dele na divisão. */
  base: number;
  /** Soma das bases de todos os jogadores do time. */
  baseTime: number;
  /** O que foi usado de fato: no modo kills, um time sem kills é dividido pelos minutos (D21). */
  baseUsada: ModoDivisao;
  premioCentavos: number;
  /** Recebeu 1 centavo além da parte inteira, para a soma fechar (D9). */
  recebeuCentavo: boolean;
  /** Frase para o extrato quando a divisão fugiu do modo escolhido; senão, null. */
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
    if (premioCentavos === 0) continue; // time sem prêmio não gera linhas de jogador

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

/** Minutos e kills de cada jogador somados só nas partidas em que ele jogou por este time. */
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
