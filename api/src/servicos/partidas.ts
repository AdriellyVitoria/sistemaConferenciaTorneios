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
