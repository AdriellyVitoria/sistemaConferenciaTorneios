import type { Executor } from '../banco/conexao';

export type StatusConferencia = 'aguardando' | 'em_consulta' | 'conferida' | 'nao_encontrada' | 'times_diferentes';

/** Uma partida como a importação cria: os dados que só a planilha sabe. */
export interface NovaPartida {
  idPartida: string;
  rodada: number;
  /** aaaa-mm-dd */
  data: string;
  timeA: string;
  timeB: string;
}

/** A partida guardada, com os campos de conferência (ela é também a tabela de tarefas). */
export interface Partida extends NovaPartida {
  id: number;
  torneioId: number;
  /** O ID como veio na planilha; idPartida pode ser corrigido pela Maria (D16). */
  idPartidaPlanilha: string;
  vencedor: string | null;
  statusConferencia: StatusConferencia;
  tentativas: number;
  proximaTentativaEm: Date | null;
  ultimaTentativaEm: Date | null;
  emConsultaDesde: Date | null;
  ultimoErro: string | null;
}

interface LinhaPartida {
  id: number;
  torneio_id: number;
  id_partida: string;
  id_partida_planilha: string;
  rodada: number;
  data: string;
  time_a: string;
  time_b: string;
  vencedor: string | null;
  status_conferencia: StatusConferencia;
  tentativas: number;
  proxima_tentativa_em: Date | null;
  ultima_tentativa_em: Date | null;
  em_consulta_desde: Date | null;
  ultimo_erro: string | null;
}

/**
 * Cria as partidas do torneio, todas "aguardando" e com a primeira tentativa para agora.
 * Devolve o ID interno de cada uma pelo ID do jogo ("#40923" -> 17), para ligar as linhas.
 */
export async function inserirPartidas(
  bd: Executor,
  torneioId: number,
  partidas: NovaPartida[],
): Promise<Map<string, number>> {
  if (partidas.length === 0) return new Map();
  await bd('partidas').insert(
    partidas.map((p) => ({
      torneio_id: torneioId,
      id_partida: p.idPartida,
      id_partida_planilha: p.idPartida,
      rodada: p.rodada,
      data: p.data,
      time_a: p.timeA,
      time_b: p.timeB,
    })),
  );
  // um INSERT com várias linhas no MySQL só devolve o primeiro ID: busca todos pelo ID do jogo
  const criadas: { id: number; id_partida: string }[] = await bd('partidas')
    .select('id', 'id_partida')
    .where({ torneio_id: torneioId })
    .whereIn('id_partida', partidas.map((p) => p.idPartida));
  return new Map(criadas.map((c) => [c.id_partida, c.id]));
}

export async function listarPartidas(bd: Executor, torneioId: number): Promise<Partida[]> {
  const linhas: LinhaPartida[] = await bd('partidas').where({ torneio_id: torneioId }).orderBy('id');
  return linhas.map((l) => ({
    id: l.id,
    torneioId: l.torneio_id,
    idPartida: l.id_partida,
    idPartidaPlanilha: l.id_partida_planilha,
    rodada: l.rodada,
    data: l.data,
    timeA: l.time_a,
    timeB: l.time_b,
    vencedor: l.vencedor,
    statusConferencia: l.status_conferencia,
    tentativas: l.tentativas,
    proximaTentativaEm: l.proxima_tentativa_em,
    ultimaTentativaEm: l.ultima_tentativa_em,
    emConsultaDesde: l.em_consulta_desde,
    ultimoErro: l.ultimo_erro,
  }));
}
