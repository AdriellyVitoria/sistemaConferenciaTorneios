/** Regras da tela de progresso da conferência (etapa 4c), sem Vue nem HTTP. */

import type { Partida, StatusTorneio } from '../servicos/api';

export interface Progresso {
  conferidas: number;
  total: number;
  /** Aguardando ou em consulta: o que ainda depende do site. */
  aguardandoOSite: number;
  /** Inteiro, arredondado para baixo: 100% só quando todas foram conferidas. */
  percentual: number;
}

const dependeDoSite = (p: Partida) => p.statusConferencia === 'aguardando' || p.statusConferencia === 'em_consulta';

export function progressoDaConferencia(partidas: Partida[]): Progresso {
  const conferidas = partidas.filter((p) => p.statusConferencia === 'conferida').length;
  const total = partidas.length;
  return {
    conferidas,
    total,
    aguardandoOSite: partidas.filter(dependeDoSite).length,
    percentual: total === 0 ? 0 : Math.floor((conferidas * 100) / total),
  };
}

/**
 * A tela consulta a API enquanto houver partida esperando o site. Não encontrada e times
 * diferentes dependem da Maria (etapa 5), não do site: esperar por elas não muda nada.
 */
export const precisaAcompanhar = (partidas: Partida[]) => partidas.some(dependeDoSite);

export interface EstadoBotao {
  habilitado: boolean;
  rotulo: string;
  /** Por que está desabilitado, para mostrar ao lado do botão. */
  motivo: string | null;
}

const segundosPorExtenso = (s: number) => `${s} ${s === 1 ? 'segundo' : 'segundos'}`;

export function estadoDoTentarAgora({
  partidas,
  segundosParaTentarAgora,
  status,
}: {
  partidas: Partida[];
  segundosParaTentarAgora: number;
  status: StatusTorneio;
}): EstadoBotao {
  if (status === 'calculado') return { habilitado: false, rotulo: 'Tentar agora', motivo: 'Os prêmios já foram calculados.' };
  if (!partidas.some((p) => p.statusConferencia === 'aguardando')) {
    return { habilitado: false, rotulo: 'Tentar agora', motivo: 'Não há partida aguardando o site.' };
  }
  if (segundosParaTentarAgora > 0) {
    return {
      habilitado: false,
      rotulo: `Tentar agora (${segundosParaTentarAgora} s)`,
      motivo: `Aguarde ${segundosPorExtenso(segundosParaTentarAgora)} para tentar de novo.`,
    };
  }
  return { habilitado: true, rotulo: 'Tentar agora', motivo: null };
}

export type Tom = 'neutro' | 'info' | 'alerta' | 'erro';

export interface SituacaoNaFila {
  selo: { texto: string; tom: Tom };
  /** A frase do erro, como a API guardou. */
  motivo: string | null;
  /** "Última tentativa às X, próxima às Y" (D10). */
  horario: string;
}

/** Como cada partida aparece na aba "Aguardando o site". */
export function situacaoNaFila(partida: Partida, agora: Date, fuso?: string): SituacaoNaFila {
  if (partida.statusConferencia === 'em_consulta') {
    const desde = partida.emConsultaDesde ? ` desde ${formatarHora(partida.emConsultaDesde, fuso)}` : '';
    return { selo: { texto: 'Consultando o site', tom: 'info' }, motivo: null, horario: `Consultando${desde}` };
  }

  const proxima = partida.proximaTentativaEm && new Date(partida.proximaTentativaEm) > agora
    ? `às ${formatarHora(partida.proximaTentativaEm, fuso)}`
    : 'em instantes';

  if (!partida.ultimaTentativaEm) {
    return { selo: { texto: 'Na fila', tom: 'neutro' }, motivo: null, horario: `Primeira consulta ${proxima}` };
  }

  const selo = partida.origemDoErro === 'interno'
    ? { texto: 'Erro interno, não é o site', tom: 'erro' as const }
    : { texto: `O site falhou · ${partida.tentativas} ${partida.tentativas === 1 ? 'tentativa' : 'tentativas'}`, tom: 'alerta' as const };
  return {
    selo,
    motivo: partida.ultimoErro,
    horario: `Última tentativa às ${formatarHora(partida.ultimaTentativaEm, fuso)}, próxima ${proxima}`,
  };
}

/** "2026-10-14T15:03:09Z" -> "12:03:09" no fuso do navegador (ou no informado, para os testes). */
export function formatarHora(iso: string, fuso?: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: fuso }).format(new Date(iso));
}

/** Segundos inteiros até `alvoMs`, para cima e nunca negativos: a contagem do botão. */
export const segundosAte = (alvoMs: number, agoraMs: number) => Math.max(0, Math.ceil((alvoMs - agoraMs) / 1000));
