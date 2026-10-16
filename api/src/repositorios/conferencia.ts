import type { Knex } from 'knex';
import type { Executor } from '../banco/conexao';
import type { PartidaSite } from '../dominio/comparacao';

export interface PartidaReservada {
  id: number;
  idPartida: string;
  tentativas: number;
  reservadaEm: Date;
}

export const emSegundosInteiros = (data: Date) => new Date(Math.floor(data.getTime() / 1000) * 1000);

export async function reservarPartidas(
  bd: Knex,
  { limite, agora, quantidade }: { limite: Date; agora: Date; quantidade: number },
): Promise<PartidaReservada[]> {
  const reservadaEm = new Date(agora);
  return bd.transaction(async (trx) => {
    const prontas: { id: number; id_partida: string; tentativas: number }[] = await trx('partidas')
      .select('id', 'id_partida', 'tentativas')
      .where('status_conferencia', 'aguardando')
      .where('proxima_tentativa_em', '<=', limite)
      .orderBy([{ column: 'proxima_tentativa_em' }, { column: 'id' }])
      .limit(quantidade)
      .forUpdate()
      .skipLocked();
    if (prontas.length === 0) return [];

    for (const { id } of prontas) {
      await trx('partidas')
        .where({ id })
        .update({ status_conferencia: 'em_consulta', em_consulta_desde: reservadaEm, ultima_tentativa_em: emSegundosInteiros(reservadaEm) });
    }
    return prontas.map((p) => ({ id: p.id, idPartida: p.id_partida, tentativas: p.tentativas, reservadaEm }));
  });
}

export async function recuperarPresas(bd: Executor, { presaAntesDe, agora }: { presaAntesDe: Date; agora: Date }): Promise<number> {
  return bd('partidas')
    .where('status_conferencia', 'em_consulta')
    .where('em_consulta_desde', '<', presaAntesDe)
    .update({
      status_conferencia: 'aguardando',
      em_consulta_desde: null,
      proxima_tentativa_em: emSegundosInteiros(agora),
      ultimo_erro: 'A consulta foi interrompida antes de terminar e será feita de novo.',
      origem_do_erro: 'interno',
    });
}

export async function contarAguardando(bd: Executor, torneioId: number): Promise<number> {
  const [{ n }] = await bd('partidas').where({ torneio_id: torneioId, status_conferencia: 'aguardando' }).count({ n: '*' });
  return Number(n);
}

export async function anteciparAguardando(bd: Executor, torneioId: number, agora: Date): Promise<number> {
  const agoraEmSegundos = emSegundosInteiros(agora);
  return bd('partidas')
    .where({ torneio_id: torneioId, status_conferencia: 'aguardando' })
    .where('proxima_tentativa_em', '>', agoraEmSegundos)
    .update({ proxima_tentativa_em: agoraEmSegundos });
}

const aindaReservada = (bd: Executor, reserva: PartidaReservada) =>
  bd('partidas').where({ id: reserva.id, status_conferencia: 'em_consulta', em_consulta_desde: reserva.reservadaEm });

const encerrarReserva = { em_consulta_desde: null, proxima_tentativa_em: null };

export async function gravarEncontrada(bd: Knex, reserva: PartidaReservada, partida: PartidaSite): Promise<boolean> {
  return bd.transaction(async (trx) => {
    const daPartida: { torneio_id: number } | undefined = await trx('partidas').where({ id: reserva.id }).first('torneio_id');
    if (!daPartida) return false;
    await trx('torneios').where({ id: daPartida.torneio_id }).forShare().first('id');

    const atualizadas = await aindaReservada(trx, reserva).update({
      ...encerrarReserva,
      status_conferencia: 'conferida',
      vencedor: partida.vencedor,
      ultimo_erro: null,
      origem_do_erro: null,
    });
    if (atualizadas === 0) return false;

    if (partida.jogadores.length) {
      await trx('participacoes').insert(
        partida.jogadores.map((j) => ({ partida_id: reserva.id, time: j.time, nick: j.nick, minutos: j.minutos, kills: j.kills })),
      );
    }
    return true;
  });
}

export async function devolverAposErro(bd: Executor, reserva: PartidaReservada, { proximaTentativaEm }: { proximaTentativaEm: Date }): Promise<boolean> {
  const atualizadas = await aindaReservada(bd, reserva).update({
    status_conferencia: 'aguardando',
    em_consulta_desde: null,
    proxima_tentativa_em: emSegundosInteiros(proximaTentativaEm),
    ultimo_erro: 'Erro inesperado ao conferir a partida; ela será consultada de novo.',
    origem_do_erro: 'interno',
  });
  return atualizadas > 0;
}

export async function gravarNaoEncontrada(bd: Executor, reserva: PartidaReservada): Promise<boolean> {
  const atualizadas = await aindaReservada(bd, reserva).update({ ...encerrarReserva, status_conferencia: 'nao_encontrada', ultimo_erro: null, origem_do_erro: null });
  return atualizadas > 0;
}

export async function gravarIndisponivel(
  bd: Executor,
  reserva: PartidaReservada,
  { proximaTentativaEm, erro }: { proximaTentativaEm: Date; erro: string },
): Promise<boolean> {
  const atualizadas = await aindaReservada(bd, reserva).update({
    status_conferencia: 'aguardando',
    em_consulta_desde: null,
    tentativas: reserva.tentativas + 1,
    proxima_tentativa_em: emSegundosInteiros(proximaTentativaEm),
    ultimo_erro: erro.slice(0, 255),
    origem_do_erro: 'site',
  });
  return atualizadas > 0;
}
