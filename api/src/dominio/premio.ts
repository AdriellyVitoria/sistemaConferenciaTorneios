/**
 * Prêmio por time (etapa 1, parte 4b). A divisão entre jogadores é o 4c.
 *
 * Função pura: recebe a classificação, o prêmio em centavos e os percentuais por posição
 * (ex.: [50, 30, 20]) e devolve o prêmio de cada time.
 * - Cada posição recebe o seu percentual; posições além da lista recebem 0%. Os percentuais
 *   precisam somar 100, e o prêmio é dividido entre as posições pelo maior resto (D20).
 * - Menos times do que posições premiadas: o valor das posições sem time é dividido igual entre
 *   todos os times (D24).
 * - Times empatados na mesma posição somam os valores das posições que ocupam e dividem
 *   igual entre si, pelo maior resto com o nome do time (D2, D9).
 */

import type { ClassificacaoTime, CriterioClassificacao } from './classificacao';
import { dividirMaiorResto } from './divisao';
import { ErroDeRegra } from './erro-de-regra';

export type CriterioPremio = CriterioClassificacao | 'divisão igual (empate em vitórias e kills)';

export interface PremioTime extends Omit<ClassificacaoTime, 'criterio'> {
  /** Com prêmio dividido, "divisão igual (empate em vitórias e kills)". */
  criterio: CriterioPremio | null;
  premioCentavos: number;
  /** Recebeu 1 centavo a mais na divisão igual entre times empatados. */
  recebeuCentavo: boolean;
}

export function premiarTimes(
  classificacao: ClassificacaoTime[],
  premio: number,
  percentuais: number[],
): PremioTime[] {
  const valorDaPosicao = valoresPorPosicao(premio, percentuais, classificacao.length);

  // times empatados têm a mesma posição; o grupo ocupa as posições seguintes (3º e 4º, por exemplo)
  const grupos = new Map<number, ClassificacaoTime[]>();
  for (const t of classificacao) grupos.set(t.posicao, [...(grupos.get(t.posicao) ?? []), t]);

  const premios = new Map<string, PremioTime>();
  for (const [posicao, times] of grupos) {
    let valorDoGrupo = 0;
    for (let p = posicao; p < posicao + times.length; p++) valorDoGrupo += valorDaPosicao(p);

    const partes = dividirMaiorResto(valorDoGrupo, times.map((t) => ({ nome: t.time, peso: 1 })));
    times.forEach((t, i) => {
      const dividido = times.length > 1 && valorDoGrupo > 0;
      premios.set(t.time, {
        ...t,
        criterio: dividido && t.criterio === 'empate em vitórias e kills'
          ? 'divisão igual (empate em vitórias e kills)'
          : t.criterio,
        premioCentavos: partes[i].valor,
        recebeuCentavo: partes[i].recebeuCentavo,
      });
    });
  }
  return classificacao.map((t) => premios.get(t.time)!);
}

/**
 * D20: os percentuais precisam ser inteiros e somar 100. Devolve a mensagem para a Maria, ou
 * null se estiver tudo certo. A criação do torneio (etapa 3) usa a mesma validação.
 */
export function erroDosPercentuais(percentuais: number[]): string | null {
  if (percentuais.some((pct) => !Number.isSafeInteger(pct) || pct < 0)) {
    return 'Os percentuais precisam ser números inteiros, como 50, 30 e 20.';
  }
  const soma = percentuais.reduce((a, b) => a + b, 0);
  return soma === 100 ? null : `Os percentuais precisam somar 100. Hoje somam ${soma}.`;
}

/**
 * Valor em centavos de cada posição (1ª = percentuais[0]). D20: o prêmio é dividido entre as
 * posições pelo maior resto, com os percentuais como pesos, e a soma fecha no prêmio. Empate na
 * fração: o centavo vai para a melhor colocada.
 *
 * D24: com menos times do que posições premiadas, o valor das posições sem time é dividido igual
 * entre todos os times (posições 1 a N), pelo maior resto, com o centavo indo primeiro ao mais bem
 * colocado. Ex.: R$ 10.000 em 50/30/20 com 2 times: 1º R$ 6.000, 2º R$ 4.000. Nenhum dinheiro fica
 * sem dono.
 */
function valoresPorPosicao(premio: number, percentuais: number[], quantidadeDeTimes: number): (posicao: number) => number {
  const erro = erroDosPercentuais(percentuais);
  if (erro) throw new ErroDeRegra(erro);
  if (quantidadeDeTimes === 0) throw new ErroDeRegra('Não há times para receber o prêmio.');

  const partes = dividirMaiorResto(
    premio,
    percentuais.map((pct, i) => ({ nome: `${i + 1}º lugar`, peso: pct })),
    { desempate: 'ordem_da_lista' },
  ).map((p) => p.valor);

  // D24: o que sobra nas posições além do último time vai, dividido igual, para os times
  const semTime = partes.slice(quantidadeDeTimes).reduce((soma, v) => soma + v, 0);
  const valores = partes.slice(0, quantidadeDeTimes);
  if (semTime > 0) {
    const divididos = dividirMaiorResto(
      semTime,
      valores.map((_, i) => ({ nome: `${i + 1}º lugar`, peso: 1 })),
      { desempate: 'ordem_da_lista' },
    );
    divididos.forEach((parte, i) => {
      valores[i] += parte.valor;
    });
  }
  return (posicao) => valores[posicao - 1] ?? 0;
}
