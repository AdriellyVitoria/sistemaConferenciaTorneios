import type { Executor } from '../banco/conexao';
import { emSegundosInteiros } from './conferencia';

export type StatusConferencia = 'aguardando' | 'em_consulta' | 'conferida' | 'nao_encontrada' | 'times_diferentes';
export type OrigemDoErro = 'site' | 'interno';

export interface NovaPartida {
  idPartida: string;
  rodada: number;
  data: string;
  timeA: string;
  timeB: string;
}

export interface Partida extends NovaPartida {
  id: number;
  torneioId: number;
  idPartidaPlanilha: string;
  vencedor: string | null;
  statusConferencia: StatusConferencia;
  tentativas: number;
  proximaTentativaEm: Date | null;
  ultimaTentativaEm: Date | null;
  emConsultaDesde: Date | null;
  ultimoErro: string | null;
  origemDoErro: OrigemDoErro | null;
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
  origem_do_erro: OrigemDoErro | null;
}

export async function inserirPartidas(
  bd: Executor,
  torneioId: number,
  partidas: NovaPartida[],
  agora: Date,
): Promise<Map<string, number>> {
  if (partidas.length === 0) return new Map();
  const proximaTentativaEm = emSegundosInteiros(agora);
  await bd('partidas').insert(
    partidas.map((p) => ({
      torneio_id: torneioId,
      id_partida: p.idPartida,
      id_partida_planilha: p.idPartida,
      rodada: p.rodada,
      data: p.data,
      time_a: p.timeA,
      time_b: p.timeB,
      proxima_tentativa_em: proximaTentativaEm,
    })),
  );
  const criadas: { id: number; id_partida: string }[] = await bd('partidas')
    .select('id', 'id_partida')
    .where({ torneio_id: torneioId })
    .whereIn('id_partida', partidas.map((p) => p.idPartida));
  return new Map(criadas.map((c) => [c.id_partida, c.id]));
}

export async function apagarPartidasDoTorneio(bd: Executor, torneioId: number): Promise<number> {
  return bd('partidas').where({ torneio_id: torneioId }).del();
}

export async function listarPartidas(bd: Executor, torneioId: number): Promise<Partida[]> {
  const linhas: LinhaPartida[] = await bd('partidas').where({ torneio_id: torneioId }).orderBy('id');
  return linhas.map(paraPartida);
}

export async function buscarPartidaParaAtualizar(trx: Executor, torneioId: number, partidaId: number): Promise<Partida | null> {
  const linha: LinhaPartida | undefined = await trx('partidas').where({ id: partidaId, torneio_id: torneioId }).forUpdate().first();
  return linha ? paraPartida(linha) : null;
}

export async function buscarPartida(bd: Executor, partidaId: number): Promise<Partida | null> {
  const linha: LinhaPartida | undefined = await bd('partidas').where({ id: partidaId }).first();
  return linha ? paraPartida(linha) : null;
}

export async function idJaUsado(bd: Executor, torneioId: number, idPartida: string, excetoPartidaId: number): Promise<boolean> {
  const outra = await bd('partidas').where({ torneio_id: torneioId, id_partida: idPartida }).whereNot({ id: excetoPartidaId }).first('id');
  return outra !== undefined;
}

export async function corrigirIdPartida(bd: Executor, partidaId: number, idPartida: string, agora: Date): Promise<void> {
  await bd('participacoes').where({ partida_id: partidaId }).del();
  await bd('partidas').where({ id: partidaId }).update({
    id_partida: idPartida,
    status_conferencia: 'aguardando',
    tentativas: 0,
    proxima_tentativa_em: new Date(Math.floor(agora.getTime() / 1000) * 1000),
    ultima_tentativa_em: null,
    em_consulta_desde: null,
    vencedor: null,
    ultimo_erro: null,
    origem_do_erro: null,
  });
}

function paraPartida(l: LinhaPartida): Partida {
  return {
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
    origemDoErro: l.origem_do_erro,
  };
}
