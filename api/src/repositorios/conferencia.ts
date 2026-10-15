/**
 * A fila da conferência (etapa 4b). A tabela partidas é a tabela de tarefas: o job reserva as
 * partidas prontas, consulta o site FORA de qualquer transação (leva de 2 a 10 s) e grava o
 * resultado. A reserva funciona como um "recibo": a gravação só acontece se a partida ainda
 * existir e ainda estiver reservada por aquela mesma execução.
 */

import type { Knex } from 'knex';
import type { Executor } from '../banco/conexao';
import type { PartidaSite } from '../dominio/comparacao';

export interface PartidaReservada {
  id: number;
  idPartida: string;
  /** Falhas seguidas até agora; a próxima falha agenda com tentativas + 1 (D10). */
  tentativas: number;
  /** O recibo da reserva: o valor gravado em em_consulta_desde. */
  reservadaEm: Date;
}

/**
 * As outras colunas de horário (ultima_tentativa_em, proxima_tentativa_em) guardam segundos
 * inteiros, e o MySQL ARREDONDA a fração ao gravar: 09:00:00.700 viraria 09:00:01. Cortar antes
 * deixa o horário gravado igual ao calculado. O recibo (em_consulta_desde) é DATETIME(3) e
 * guarda os milissegundos.
 */
export const emSegundosInteiros = (data: Date) => new Date(Math.floor(data.getTime() / 1000) * 1000);

/**
 * Reserva até `quantidade` partidas "aguardando" cuja próxima tentativa já chegou (até `limite`),
 * marcando "em_consulta". SELECT ... FOR UPDATE SKIP LOCKED: se outra execução do job está
 * reservando ao mesmo tempo, as partidas que ela travou são puladas, sem esperar nem repetir.
 * A transação é curta e termina antes da consulta ao site.
 */
export async function reservarPartidas(
  bd: Knex,
  { limite, agora, quantidade }: { limite: Date; agora: Date; quantidade: number },
): Promise<PartidaReservada[]> {
  // o recibo, com milissegundos: duas reservas da mesma partida no mesmo segundo têm recibos diferentes
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

    // Uma partida por vez, pela chave. Um UPDATE ... WHERE id IN (...) com quase a tabela toda faz
    // o MySQL varrer a tabela e esperar as linhas travadas por outra execução, o que o SKIP LOCKED
    // acabou de evitar. O lote é pequeno (CONFERENCIA_LOTE).
    for (const { id } of prontas) {
      await trx('partidas')
        .where({ id })
        .update({ status_conferencia: 'em_consulta', em_consulta_desde: reservadaEm, ultima_tentativa_em: emSegundosInteiros(reservadaEm) });
    }
    return prontas.map((p) => ({ id: p.id, idPartida: p.id_partida, tentativas: p.tentativas, reservadaEm }));
  });
}

/**
 * Partidas "em_consulta" desde antes de `presaAntesDe` ficaram presas (o processo caiu no meio da
 * consulta): voltam para a fila, prontas para agora. Não contam como tentativa, porque a falha foi
 * do sistema e não do site. Devolve quantas foram recuperadas.
 */
export async function recuperarPresas(bd: Executor, { presaAntesDe, agora }: { presaAntesDe: Date; agora: Date }): Promise<number> {
  return bd('partidas')
    .where('status_conferencia', 'em_consulta')
    .where('em_consulta_desde', '<', presaAntesDe)
    .update({
      status_conferencia: 'aguardando',
      em_consulta_desde: null,
      proxima_tentativa_em: emSegundosInteiros(agora),
      ultimo_erro: 'A consulta foi interrompida antes de terminar e será feita de novo.',
    });
}

/** Só a partida ainda reservada com este recibo: apagada (D22) ou recuperada, não é mais nossa. */
const aindaReservada = (bd: Executor, reserva: PartidaReservada) =>
  bd('partidas').where({ id: reserva.id, status_conferencia: 'em_consulta', em_consulta_desde: reserva.reservadaEm });

const encerrarReserva = { em_consulta_desde: null, proxima_tentativa_em: null };

/**
 * O site encontrou a partida: grava o vencedor e a participação de cada jogador, como o site
 * registrou (D3), e marca "conferida". Devolve false se a reserva não vale mais (resultado descartado).
 */
export async function gravarEncontrada(bd: Knex, reserva: PartidaReservada, partida: PartidaSite): Promise<boolean> {
  return bd.transaction(async (trx) => {
    // Mesma ordem de travas da importação da planilha (torneio -> partidas -> participações).
    // Na ordem inversa, uma planilha substituída no meio da gravação causaria deadlock: o job
    // travaria a partida e esperaria as participações, a importação faria o contrário.
    // A trava do torneio é compartilhada: as gravações do job não esperam umas pelas outras.
    const daPartida: { torneio_id: number } | undefined = await trx('partidas').where({ id: reserva.id }).first('torneio_id');
    if (!daPartida) return false;
    await trx('torneios').where({ id: daPartida.torneio_id }).forShare().first('id');

    const atualizadas = await aindaReservada(trx, reserva).update({
      ...encerrarReserva,
      status_conferencia: 'conferida',
      vencedor: partida.vencedor,
      ultimo_erro: null,
    });
    if (atualizadas === 0) return false;

    // A atualização acima travou a partida até o fim da transação: ninguém a apaga no meio.
    // Não há participações antigas para apagar: só uma partida "aguardando" é reservada, e uma
    // partida conferida só volta para a fila pela correção do ID (etapa 5), que apaga as dela.
    // (Um DELETE aqui, sem linhas, trava o intervalo vazio do índice e causa deadlock entre as
    // gravações em paralelo.)
    if (partida.jogadores.length) {
      await trx('participacoes').insert(
        partida.jogadores.map((j) => ({ partida_id: reserva.id, time: j.time, nick: j.nick, minutos: j.minutos, kills: j.kills })),
      );
    }
    return true;
  });
}

/**
 * Deu erro do nosso lado (defeito, deadlock, gravação recusada): a partida volta para a fila sem
 * contar tentativa, como a partida presa, porque o site não falhou. Espera o primeiro intervalo
 * (`proximaTentativaEm`), para um defeito que se repete não virar consulta a cada rodada.
 */
export async function devolverAposErro(bd: Executor, reserva: PartidaReservada, { proximaTentativaEm }: { proximaTentativaEm: Date }): Promise<boolean> {
  const atualizadas = await aindaReservada(bd, reserva).update({
    status_conferencia: 'aguardando',
    em_consulta_desde: null,
    proxima_tentativa_em: emSegundosInteiros(proximaTentativaEm),
    ultimo_erro: 'Erro inesperado ao conferir a partida; ela será consultada de novo.',
  });
  return atualizadas > 0;
}

/** O site não conhece o ID (D5): sai da fila até a Maria corrigir o ID (D16). */
export async function gravarNaoEncontrada(bd: Executor, reserva: PartidaReservada): Promise<boolean> {
  const atualizadas = await aindaReservada(bd, reserva).update({ ...encerrarReserva, status_conferencia: 'nao_encontrada', ultimo_erro: null });
  return atualizadas > 0;
}

/** O site não respondeu direito: volta para a fila, com mais uma tentativa e a próxima agendada (D10). */
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
  });
  return atualizadas > 0;
}
