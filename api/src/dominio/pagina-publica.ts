/**
 * A página pública do torneio (D11, etapa 7a): o que qualquer jogador pode ver, inclusive os
 * dos times sem prêmio. Classificação, regras e prêmio por time, SEM nenhum valor nem nick de
 * jogador: o extrato de cada jogador fica no link do time (etapa 7b).
 *
 * Monta tudo do resultado congelado (6a): nada é recalculado.
 */

import type { ModoDivisao } from './rateio';

/** O que a página usa do resultado gravado (o ResultadoGravado do repositório tem isso e mais). */
export interface ResultadoCongelado {
  calculadoEm: Date;
  premioCentavos: number;
  percentuais: number[];
  modoDivisao: ModoDivisao;
  times: TimeDaPaginaPublica[];
}

/** A regra de desempate da D2, para quem não leu o regulamento. */
export const CRITERIO_DE_DESEMPATE =
  'Ganha a melhor posição quem tem mais vitórias. Empate em vitórias: fica na frente o time com mais kills no torneio. '
  + 'Empate também em kills: os prêmios das posições empatadas são somados e divididos igualmente entre os times; '
  + 'se sobrar centavo, ele vai para o time que mais perdeu no arredondamento e, se ainda empatar, pela ordem alfabética do nome do time.';

export interface TimeDaPaginaPublica {
  posicao: number;
  time: string;
  vitorias: number;
  killsTime: number;
  premioCentavos: number;
  criterio: string | null;
}

export interface PaginaPublica {
  torneio: { nome: string };
  calculadoEm: Date;
  regras: {
    premioCentavos: number;
    percentuais: number[];
    modoDivisao: ModoDivisao;
    criterioDeDesempate: string;
  };
  classificacao: TimeDaPaginaPublica[];
}

/**
 * Copia campo a campo, em vez de tirar `jogadores` do objeto: se um dia o resultado ganhar um
 * campo novo com dado de jogador, ele não vaza para a página pública sem alguém decidir.
 */
export function montarPaginaPublica(nomeDoTorneio: string, resultado: ResultadoCongelado): PaginaPublica {
  return {
    torneio: { nome: nomeDoTorneio },
    calculadoEm: resultado.calculadoEm,
    regras: {
      premioCentavos: resultado.premioCentavos,
      percentuais: resultado.percentuais,
      modoDivisao: resultado.modoDivisao,
      criterioDeDesempate: CRITERIO_DE_DESEMPATE,
    },
    classificacao: resultado.times.map((t) => ({
      posicao: t.posicao,
      time: t.time,
      vitorias: t.vitorias,
      killsTime: t.killsTime,
      premioCentavos: t.premioCentavos,
      criterio: t.criterio,
    })),
  };
}
