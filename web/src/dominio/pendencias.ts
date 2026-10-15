/** Regras e textos da revisão das pendências (etapa 5d, D17), sem Vue nem HTTP. */

import type { ListaDePendencias, Partida, Pendencia, TipoPendencia } from '../servicos/api';
import { rotuloDoId } from './torneio';

const TIPOS: Record<TipoPendencia, string> = {
  nao_encontrada: 'Partida não encontrada no site',
  times_diferentes: 'Times diferentes no site',
  sem_dados_planilha: 'Partida sem dados na planilha',
  duplicata: 'Linha duplicada',
  nick_diferente: 'Nick escrito diferente',
  divergencia: 'Valor diferente do site',
  jogador_so_na_planilha: 'Jogador só na planilha',
  jogador_so_no_site: 'Jogador só no site',
  time_escrito_diferente: 'Time escrito diferente',
  jogador_dois_times: 'Jogador em dois times',
};

export const rotuloDoTipo = (tipo: TipoPendencia) => TIPOS[tipo];

/** Quantas ainda faltam: as bloqueantes (corrigir o ID) e as não bloqueantes sem Ciente. */
export const pendenciasQueFaltam = (lista: ListaDePendencias) => lista.resumo.bloqueantes + lista.resumo.semCiente;

/** As partidas de uma pendência: a dela, ou as do torneio todo (jogador em dois times, nome de time). */
const partidasDa = (p: Pendencia) => (p.idPartida ? [p.idPartida] : (p.partidas ?? []));

/** "#46065" -> "Partida #46065 · Rodada 2 · Lobos x Panteras"; itens do torneio todo listam as partidas. */
export function tituloDaPendencia(p: Pendencia, partidas: Partida[]): string {
  if (!p.idPartida) {
    const ids = partidasDa(p);
    return ids.length === 1 ? `Partida ${ids[0]}` : `Partidas ${ids.slice(0, -1).join(', ')} e ${ids.at(-1)}`;
  }
  const partida = partidas.find((x) => x.idPartida === p.idPartida);
  return partida ? `Partida ${rotuloDoId(partida)} · Rodada ${partida.rodada} · ${partida.timeA} x ${partida.timeB}` : `Partida ${p.idPartida}`;
}

/** Para o rótulo acessível dos botões: "Nick escrito diferente, partida #48087". */
export function descricaoCurta(p: Pendencia): string {
  const ids = partidasDa(p);
  return `${rotuloDoTipo(p.tipo)}, ${ids.length === 1 ? 'partida' : 'partidas'} ${ids.join(', ')}`;
}

const CAMPOS = { minutos: 'Minutos', kills: 'Kills', vencedor: 'Vencedor', time: 'Time' } as const;

/** O nome da linha no lado a lado (planilha × site). */
export function rotuloDoValor(p: Pendencia): string {
  if (p.campo) return CAMPOS[p.campo];
  switch (p.tipo) {
    case 'nao_encontrada': return 'ID da partida';
    case 'times_diferentes': return 'Times';
    case 'sem_dados_planilha': return 'Resultado';
    case 'nick_diferente': return 'Nick';
    case 'time_escrito_diferente': return 'Time';
    case 'jogador_dois_times': return `Times de ${p.nick}`;
    default: return p.nick ?? 'Valor';
  }
}

/** O valor de um lado; vazio vira uma frase, e não um traço sem sentido. */
export function valorDoLado(p: Pendencia, lado: 'planilha' | 'site'): string {
  const valor = lado === 'planilha' ? p.valorPlanilha : p.valorSite;
  if (valor !== null && valor !== '') return valor;
  if (lado === 'site' && p.tipo === 'nao_encontrada') return 'Não encontrada';
  if (lado === 'site' && p.tipo === 'jogador_so_na_planilha') return 'Não registra o jogador';
  if (lado === 'planilha' && p.tipo === 'jogador_so_no_site') return 'Não está na planilha';
  if (lado === 'planilha' && p.tipo === 'jogador_dois_times') return 'Um time em cada partida';
  return 'Vazio';
}

export interface PartidaConferida {
  partida: Partida;
  /** As pendências da partida que já receberam Ciente; vazio = bateu com o site. */
  comCiente: Pendencia[];
}

/**
 * A aba "Conferidas" (D17): partidas conferidas no site sem nada faltando, ou seja, que bateram
 * com o site ou cujas pendências já receberam Ciente. Uma partida com pendência bloqueante ou
 * sem Ciente fica em "Pendências", nunca nas duas.
 */
export function partidasConferidas(partidas: Partida[], lista: ListaDePendencias): PartidaConferida[] {
  const faltando = new Set([...lista.bloqueantes, ...lista.naoBloqueantes.filter((p) => !p.ciente)].flatMap(partidasDa));
  const comCiente = lista.naoBloqueantes.filter((p) => p.ciente);
  return partidas
    .filter((p) => p.statusConferencia === 'conferida' && !faltando.has(p.idPartida))
    .map((partida) => ({ partida, comCiente: comCiente.filter((p) => partidasDa(p).includes(partida.idPartida)) }));
}

export type FiltroConferidas = 'todas' | 'bateram' | 'com_ciente';

export function filtrarConferidas(conferidas: PartidaConferida[], filtro: FiltroConferidas): PartidaConferida[] {
  if (filtro === 'bateram') return conferidas.filter((c) => c.comCiente.length === 0);
  if (filtro === 'com_ciente') return conferidas.filter((c) => c.comCiente.length > 0);
  return conferidas;
}

export function contarConferidas(conferidas: PartidaConferida[]): Record<FiltroConferidas, number> {
  const comCiente = conferidas.filter((c) => c.comCiente.length > 0).length;
  return { todas: conferidas.length, bateram: conferidas.length - comCiente, com_ciente: comCiente };
}

/** As partidas por rodada, na ordem; a data da rodada é a da sua primeira partida ("05/09"). */
export function agruparPorRodada(conferidas: PartidaConferida[]): { rodada: number; data: string; itens: PartidaConferida[] }[] {
  const grupos = new Map<number, PartidaConferida[]>();
  for (const c of [...conferidas].sort((a, b) => a.partida.rodada - b.partida.rodada || a.partida.id - b.partida.id)) {
    grupos.set(c.partida.rodada, [...(grupos.get(c.partida.rodada) ?? []), c]);
  }
  return [...grupos].map(([rodada, itens]) => {
    const [, mes, dia] = [...itens.map((i) => i.partida.data)].sort()[0].split('-');
    return { rodada, data: `${dia}/${mes}`, itens };
  });
}

/** Uma linha com o que era a diferença, para a aba Conferidas: "Nick escrito diferente: xxsniperxx → xXSniperXx". */
export function resumoDaDiferenca(p: Pendencia): string {
  const de = p.valorPlanilha ?? '—';
  const para = p.valorSite ?? '—';
  const detalhe = (() => {
    switch (p.tipo) {
      case 'duplicata': return `${p.nick} contado uma vez`;
      case 'sem_dados_planilha': return 'usados os dados do site';
      case 'divergencia': return p.campo === 'vencedor' ? `vencedor ${de} → ${para}` : `${p.nick}, ${CAMPOS[p.campo ?? 'minutos'].toLowerCase()} ${de} → ${para}`;
      case 'jogador_so_na_planilha': return `${p.nick} não está no site`;
      case 'jogador_so_no_site': return `${p.nick} só no site`;
      case 'jogador_dois_times': return `${p.nick} jogou por ${para}`;
      default: return `${de} → ${para}`;
    }
  })();
  return `${rotuloDoTipo(p.tipo)}: ${detalhe}`;
}

const plural = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

/** Os textos do modal do "Ciente de todas". */
export function textosDoCienteDeTodas(semCiente: number, bloqueantes: number) {
  let aviso: string | null = null;
  if (bloqueantes === 1) aviso = 'A pendência que pede correção do ID não entra.';
  if (bloqueantes > 1) aviso = `As ${bloqueantes} pendências que pedem correção do ID não entram.`;
  return {
    titulo: `Marcar Ciente em ${plural(semCiente, 'pendência', 'pendências')}?`,
    bloqueantes: aviso,
    confirmar: `Marcar Ciente em ${semCiente}`,
  };
}

export const textoDasMarcadas = (marcadas: number) =>
  marcadas === 1 ? '1 pendência marcada com Ciente.' : `${marcadas} pendências marcadas com Ciente.`;
