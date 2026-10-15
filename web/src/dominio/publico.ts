/**
 * Regras da página pública (7c), sem Vue nem HTTP: o regulamento do torneio em texto simples, para
 * o jogador entender a classificação sem precisar perguntar à Maria. Tudo sai do que foi gravado
 * no cálculo; nenhum valor é recalculado.
 */

import type { PaginaPublica } from '../servicos/api';
import { formatarCentavos } from './dinheiro';
import { descreverPosicoesPremiadas } from './resultado';

const ARREDONDAMENTO = 'Os valores são arredondados para o centavo; o centavo que sobra vai para quem estava mais perto de recebê-lo.';

const DENTRO_DO_TIME = {
  minutos: 'Proporcional aos minutos que cada jogador jogou, pelo registro oficial de cada partida.',
  kills: 'Proporcional às kills de cada jogador, pelo registro oficial de cada partida. Se ninguém do time fez kills, o prêmio do time é dividido pelos minutos jogados.',
} as const;

export interface Regra {
  rotulo: string;
  texto: string;
}

/** As regras gravadas no cálculo, uma por linha. `quantidadeDeTimes` vem da classificação. */
export function regrasEmTexto(regras: PaginaPublica['regras'], quantidadeDeTimes: number): Regra[] {
  const premiadas = regras.percentuais.filter((p) => p > 0).length;
  let entreOsTimes = `${descreverPosicoesPremiadas(regras.percentuais)}.`;
  if (quantidadeDeTimes > premiadas) entreOsTimes += ' Os outros times não recebem prêmio.';
  // D24: as posições sem time foram divididas igualmente; sem a frase, a tabela pareceria errada
  if (quantidadeDeTimes < premiadas) {
    entreOsTimes += ' O torneio teve menos times do que posições premiadas: o valor das posições sem time foi dividido igualmente entre todos os times.';
  }
  return [
    { rotulo: 'Prêmio total', texto: formatarCentavos(regras.premioCentavos) },
    { rotulo: 'Divisão entre os times', texto: entreOsTimes },
    { rotulo: 'Dentro do time', texto: `${DENTRO_DO_TIME[regras.modoDivisao]} ${ARREDONDAMENTO}` },
    { rotulo: 'Desempate', texto: regras.criterioDeDesempate },
  ];
}
