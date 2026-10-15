/**
 * O torneio pode ser calculado? (etapa 5c, D17). Função pura: recebe as contagens e diz.
 *
 * Só pode quando:
 * - há planilha (pelo menos uma partida);
 * - nenhuma partida aguardando o site ou em consulta;
 * - nenhum bloqueio (não encontrada, times diferentes): esses se resolvem corrigindo o ID;
 * - todas as pendências não bloqueantes têm Ciente: nada é pago sem a Maria ter visto.
 * Depois do cálculo, informa que já foi calculado: não se calcula de novo (D1, D22).
 */

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
