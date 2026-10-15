/**
 * Pendências do torneio e o "Ciente" da Maria (etapa 5a).
 *
 * As pendências saem sempre da comparação atual (compararComSite, D19) entre o que a Maria
 * digitou (linhas_planilha) e o que o site registrou (partidas + participacoes). Só os Cientes
 * são gravados, pela chave de cada pendência: uma pendência que mudou tem outra chave, e o Ciente
 * antigo não vale para ela.
 *
 * Bloqueantes (não encontrada, times diferentes) não aceitam Ciente: se resolvem corrigindo o ID
 * (etapa 5b). Depois do cálculo, nenhum Ciente muda.
 */

import type { Knex } from 'knex';
import type { Executor } from '../banco/conexao';
import { chaveDaPendencia, ehBloqueante } from '../dominio/chave-pendencia';
import { compararComSite, type ItemPendencia, type PartidaSite, type RespostaSite } from '../dominio/comparacao';
import type { LinhaPlanilha } from '../dominio/planilha';
import { listarLinhas } from '../repositorios/linhas-planilha';
import { listarPartidas, type Partida } from '../repositorios/partidas';
import {
  apagarCiente,
  gravarCientes,
  listarCientes,
  listarParticipacoes,
  type ParticipacaoGuardada,
} from '../repositorios/pendencias';
import { buscarTorneio, buscarTorneioParaAtualizar } from '../repositorios/torneios';

export interface PendenciaListada extends ItemPendencia {
  chave: string;
  bloqueante: boolean;
  ciente: boolean;
  cienteEm: Date | null;
}

export interface ListaDePendencias {
  /** Só se resolvem corrigindo o ID da partida. */
  bloqueantes: PendenciaListada[];
  /** Aceitam Ciente; enquanto não o recebem, também seguram o cálculo (D17). */
  naoBloqueantes: PendenciaListada[];
  resumo: { bloqueantes: number; naoBloqueantes: number; comCiente: number; semCiente: number; aguardandoSite: number };
}

export async function listarPendencias(bd: Knex, torneioId: number): Promise<ListaDePendencias | null> {
  if (!(await buscarTorneio(bd, torneioId))) return null;
  return calcularPendencias(bd, torneioId);
}

/** As pendências atuais do torneio (sem conferir se o torneio existe). */
export async function calcularPendencias(bd: Executor, torneioId: number): Promise<ListaDePendencias> {
  const [partidas, linhas, participacoes, cientes] = await Promise.all([
    listarPartidas(bd, torneioId),
    listarLinhas(bd, torneioId),
    listarParticipacoes(bd, torneioId),
    listarCientes(bd, torneioId),
  ]);

  // a linha é comparada com o ID atual da partida: se a Maria corrigir o ID (etapa 5b), a linha vai junto
  const idAtual = new Map(partidas.map((p) => [p.id, p.idPartida]));
  const linhasComIdAtual: LinhaPlanilha[] = linhas.map(({ partidaId, ...linha }) => ({ ...linha, idPartida: idAtual.get(partidaId)! }));

  const { pendencias, aguardandoSite } = compararComSite(linhasComIdAtual, respostasDoSite(partidas, participacoes));

  const idInterno = new Map(partidas.map((p) => [p.idPartida, p.id]));
  const listadas = pendencias.map((item): PendenciaListada => {
    const chave = chaveDaPendencia(item, item.idPartida ? idInterno.get(item.idPartida) : null);
    const cienteEm = cientes.get(chave) ?? null;
    return { ...item, chave, bloqueante: ehBloqueante(item), ciente: cienteEm !== null, cienteEm };
  });
  const bloqueantes = listadas.filter((p) => p.bloqueante);
  const naoBloqueantes = listadas.filter((p) => !p.bloqueante);
  const comCiente = naoBloqueantes.filter((p) => p.ciente).length;
  return {
    bloqueantes,
    naoBloqueantes,
    resumo: {
      bloqueantes: bloqueantes.length,
      naoBloqueantes: naoBloqueantes.length,
      comCiente,
      semCiente: naoBloqueantes.length - comCiente,
      aguardandoSite: aguardandoSite.length,
    },
  };
}

/**
 * O que o site respondeu para cada partida, montado com o que o job gravou (etapa 4b):
 * - aguardando ou em consulta: o site ainda não respondeu (sem resposta);
 * - não encontrada: o site não conhece o ID;
 * - conferida: o vencedor da partida e os jogadores de participacoes. Os dois times do site são
 *   os times desses jogadores, na ordem em que aparecem: no formato do site, todo jogador é de
 *   um dos dois times da partida.
 */
function respostasDoSite(partidas: Partida[], participacoes: ParticipacaoGuardada[]): Record<string, RespostaSite | undefined> {
  const jogadoresPorPartida = new Map<number, ParticipacaoGuardada[]>();
  for (const j of participacoes) jogadoresPorPartida.set(j.partidaId, [...(jogadoresPorPartida.get(j.partidaId) ?? []), j]);

  const respostas: Record<string, RespostaSite | undefined> = {};
  for (const p of partidas) {
    if (p.statusConferencia === 'nao_encontrada') {
      respostas[p.idPartida] = { status: 'nao_encontrada' };
    } else if (p.statusConferencia === 'conferida' || p.statusConferencia === 'times_diferentes') {
      const jogadores = (jogadoresPorPartida.get(p.id) ?? []).map(({ nick, time, minutos, kills }) => ({ nick, time, minutos, kills }));
      const times = [...new Set(jogadores.map((j) => j.time))];
      const partida: PartidaSite = {
        id: p.idPartida,
        data: p.data,
        rodada: p.rodada,
        times: [times[0] ?? '', times[1] ?? ''],
        vencedor: p.vencedor ?? '',
        jogadores,
      };
      respostas[p.idPartida] = { status: 'encontrada', partida };
    }
  }
  return respostas;
}

export type ResultadoCiente =
  | { tipo: 'feito' }
  | { tipo: 'bloqueante' }
  | { tipo: 'pendencia_nao_encontrada' }
  | { tipo: 'torneio_nao_encontrado' }
  | { tipo: 'torneio_calculado' };

/**
 * Marca (ciente = true) ou desfaz (false) o Ciente de uma pendência. Numa transação, com o
 * torneio travado: um Ciente não corre junto com uma planilha nova (D22) nem com o cálculo.
 * A chave precisa ser de uma pendência ATUAL: se os valores mudaram, ela não existe mais.
 */
export async function definirCiente(bd: Knex, torneioId: number, chave: string, ciente: boolean, agora = new Date()): Promise<ResultadoCiente> {
  return bd.transaction(async (trx) => {
    const torneio = await buscarTorneioParaAtualizar(trx, torneioId);
    if (!torneio) return { tipo: 'torneio_nao_encontrado' } as const;
    if (torneio.status === 'calculado') return { tipo: 'torneio_calculado' } as const;

    const { bloqueantes, naoBloqueantes } = await calcularPendencias(trx, torneioId);
    if (bloqueantes.some((p) => p.chave === chave)) return { tipo: 'bloqueante' } as const;
    if (!naoBloqueantes.some((p) => p.chave === chave)) return { tipo: 'pendencia_nao_encontrada' } as const;

    if (ciente) await gravarCientes(trx, torneioId, [chave], agora);
    else await apagarCiente(trx, torneioId, chave);
    return { tipo: 'feito' } as const;
  });
}

export type ResultadoCienteDeTodas =
  | { tipo: 'marcadas'; marcadas: number }
  | { tipo: 'torneio_nao_encontrado' }
  | { tipo: 'torneio_calculado' };

/** "Ciente de todas": marca as não bloqueantes que ainda não têm Ciente e diz quantas marcou. */
export async function cienteDeTodas(bd: Knex, torneioId: number, agora = new Date()): Promise<ResultadoCienteDeTodas> {
  return bd.transaction(async (trx) => {
    const torneio = await buscarTorneioParaAtualizar(trx, torneioId);
    if (!torneio) return { tipo: 'torneio_nao_encontrado' } as const;
    if (torneio.status === 'calculado') return { tipo: 'torneio_calculado' } as const;

    const { naoBloqueantes } = await calcularPendencias(trx, torneioId);
    const semCiente = naoBloqueantes.filter((p) => !p.ciente).map((p) => p.chave);
    await gravarCientes(trx, torneioId, semCiente, agora);
    return { tipo: 'marcadas', marcadas: semCiente.length } as const;
  });
}
