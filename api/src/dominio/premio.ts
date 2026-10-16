import type { ClassificacaoTime, CriterioClassificacao } from './classificacao';
import { dividirMaiorResto } from './divisao';
import { ErroDeRegra } from './erro-de-regra';

export type CriterioPremio = CriterioClassificacao | 'divisão igual (empate em vitórias e kills)';

export interface PremioTime extends Omit<ClassificacaoTime, 'criterio'> {
  criterio: CriterioPremio | null;
  premioCentavos: number;
  recebeuCentavo: boolean;
}

export function premiarTimes(
  classificacao: ClassificacaoTime[],
  premio: number,
  percentuais: number[],
): PremioTime[] {
  const valorDaPosicao = valoresPorPosicao(premio, percentuais, classificacao.length);

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

export function erroDosPercentuais(percentuais: number[]): string | null {
  if (percentuais.some((pct) => !Number.isSafeInteger(pct) || pct < 0)) {
    return 'Os percentuais precisam ser números inteiros, como 50, 30 e 20.';
  }
  const soma = percentuais.reduce((a, b) => a + b, 0);
  return soma === 100 ? null : `Os percentuais precisam somar 100. Hoje somam ${soma}.`;
}

function valoresPorPosicao(premio: number, percentuais: number[], quantidadeDeTimes: number): (posicao: number) => number {
  const erro = erroDosPercentuais(percentuais);
  if (erro) throw new ErroDeRegra(erro);
  if (quantidadeDeTimes === 0) throw new ErroDeRegra('Não há times para receber o prêmio.');

  const partes = dividirMaiorResto(
    premio,
    percentuais.map((pct, i) => ({ nome: `${i + 1}º lugar`, peso: pct })),
    { desempate: 'ordem_da_lista' },
  ).map((p) => p.valor);

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
