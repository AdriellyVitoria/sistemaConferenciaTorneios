import type { StatusTorneio } from '../repositorios/torneios';

export interface EntradaDoCalculo {
  status: StatusTorneio;
  calculadoEm: Date | null;
  quantidadeDePartidas: number;
  aguardandoSite: number;
  bloqueios: number;
  semCiente: number;
}

export interface SituacaoDoCalculo {
  podeCalcular: boolean;
  calculado: boolean;
  calculadoEm: Date | null;
  semPlanilha: boolean;
  aguardandoSite: number;
  bloqueios: number;
  semCiente: number;
}

export function situacaoDoCalculo(e: EntradaDoCalculo): SituacaoDoCalculo {
  const calculado = e.status === 'calculado';
  const semPlanilha = e.quantidadeDePartidas === 0;
  return {
    podeCalcular: !calculado && !semPlanilha && e.aguardandoSite === 0 && e.bloqueios === 0 && e.semCiente === 0,
    calculado,
    calculadoEm: e.calculadoEm,
    semPlanilha,
    aguardandoSite: e.aguardandoSite,
    bloqueios: e.bloqueios,
    semCiente: e.semCiente,
  };
}
