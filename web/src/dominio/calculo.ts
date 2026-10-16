import type { SituacaoDoCalculo } from '../servicos/api';
import { formatarHora } from './conferencia';
import { formatarDataDeCriacao } from './torneio';

export type AbaDoTorneio = 'conferidas' | 'pendencias' | 'aguardando';

export interface AvisoDoCalculo {
  estado: 'sem_planilha' | 'faltando' | 'pronto' | 'calculado';
  texto: string;
  itens: { texto: string; aba: AbaDoTorneio }[];
}

const plural = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

export function avisoDoCalculo(c: SituacaoDoCalculo, fuso?: string): AvisoDoCalculo {
  if (c.calculado) {
    const quando = c.calculadoEm ? ` em ${formatarDataDeCriacao(c.calculadoEm, fuso)} às ${formatarHora(c.calculadoEm, fuso).slice(0, 5)}` : '';
    return { estado: 'calculado', texto: `Calculado${quando}.`, itens: [] };
  }
  if (c.semPlanilha) return { estado: 'sem_planilha', texto: 'Envie a planilha para começar.', itens: [] };
  if (c.podeCalcular) return { estado: 'pronto', texto: 'Tudo conferido. Pronto para calcular.', itens: [] };

  const itens: AvisoDoCalculo['itens'] = [];
  if (c.aguardandoSite) itens.push({ texto: `${c.aguardandoSite} aguardando o site`, aba: 'aguardando' });
  if (c.bloqueios) itens.push({ texto: plural(c.bloqueios, 'bloqueio', 'bloqueios'), aba: 'pendencias' });
  if (c.semCiente) itens.push({ texto: `${c.semCiente} sem Ciente`, aba: 'pendencias' });
  return { estado: 'faltando', texto: 'Falta para calcular:', itens };
}
