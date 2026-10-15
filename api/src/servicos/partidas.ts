/**
 * Correção do ID da partida (etapa 5b, D5, D16). É a única coisa que a Maria edita: o ID é o que
 * só a planilha sabe, e corrigir dispara uma nova consulta só daquela partida.
 */

import type { Knex } from 'knex';
import { validarIdPartida } from '../dominio/planilha';
import { buscarPartida, buscarPartidaParaAtualizar, corrigirIdPartida, idJaUsado, type Partida } from '../repositorios/partidas';
import { buscarTorneioParaAtualizar } from '../repositorios/torneios';

export type ResultadoCorrecao =
  | { tipo: 'corrigida'; partida: Partida }
  | { tipo: 'invalido'; mensagem: string }
  | { tipo: 'mesmo_id' }
  | { tipo: 'id_em_uso'; idPartida: string }
  | { tipo: 'nao_encontrada' }
  | { tipo: 'torneio_calculado' };

/**
 * Valida o ID novo com as regras da importação, e, numa transação, com o torneio e a partida
 * travados (a mesma ordem da importação e do job: torneio, partidas, participações):
 * - recusa o ID de outra partida do torneio: juntar duas partidas daria 4 times (D23);
 * - grava o ID novo e devolve a partida à fila, do zero (repositório).
 * As linhas da planilha não mudam: continuam com o ID que a Maria digitou.
 */
export async function corrigirId(bd: Knex, torneioId: number, partidaId: number, texto: string, agora = new Date()): Promise<ResultadoCorrecao> {
  const validado = validarIdPartida(texto);
  if (!validado.ok) return { tipo: 'invalido', mensagem: validado.mensagem };
  const { idPartida } = validado;

  return bd.transaction(async (trx) => {
    const torneio = await buscarTorneioParaAtualizar(trx, torneioId);
    if (!torneio) return { tipo: 'nao_encontrada' } as const;
    if (torneio.status === 'calculado') return { tipo: 'torneio_calculado' } as const;

    const partida = await buscarPartidaParaAtualizar(trx, torneioId, partidaId);
    if (!partida) return { tipo: 'nao_encontrada' } as const;
    if (partida.idPartida === idPartida) return { tipo: 'mesmo_id' } as const;
    if (await idJaUsado(trx, torneioId, idPartida, partidaId)) return { tipo: 'id_em_uso', idPartida } as const;

    await corrigirIdPartida(trx, partidaId, idPartida, agora);
    return { tipo: 'corrigida', partida: (await buscarPartida(trx, partidaId))! } as const;
  });
}
