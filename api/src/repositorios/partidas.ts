import type { Executor } from '../banco/conexao';

export type StatusConferencia = 'aguardando' | 'em_consulta' | 'conferida' | 'nao_encontrada' | 'times_diferentes';
export type OrigemDoErro = 'site' | 'interno';

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
  /** De quem foi a última falha: do site, ou nossa ("erro interno, não é o site"). */
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

/**
 * Apaga as partidas do torneio. As linhas da planilha ligadas a elas saem junto (chave
 * estrangeira com ON DELETE CASCADE). Usado quando a Maria envia a planilha de novo (D22).
 */
export async function apagarPartidasDoTorneio(bd: Executor, torneioId: number): Promise<number> {
  return bd('partidas').where({ torneio_id: torneioId }).del();
}

export async function listarPartidas(bd: Executor, torneioId: number): Promise<Partida[]> {
  const linhas: LinhaPartida[] = await bd('partidas').where({ torneio_id: torneioId }).orderBy('id');
  return linhas.map(paraPartida);
}

/** A partida do torneio, TRAVADA até o fim da transação (SELECT ... FOR UPDATE). */
export async function buscarPartidaParaAtualizar(trx: Executor, torneioId: number, partidaId: number): Promise<Partida | null> {
  const linha: LinhaPartida | undefined = await trx('partidas').where({ id: partidaId, torneio_id: torneioId }).forUpdate().first();
  return linha ? paraPartida(linha) : null;
}

export async function buscarPartida(bd: Executor, partidaId: number): Promise<Partida | null> {
  const linha: LinhaPartida | undefined = await bd('partidas').where({ id: partidaId }).first();
  return linha ? paraPartida(linha) : null;
}

/** Outra partida do torneio já usa esse ID? */
export async function idJaUsado(bd: Executor, torneioId: number, idPartida: string, excetoPartidaId: number): Promise<boolean> {
  const outra = await bd('partidas').where({ torneio_id: torneioId, id_partida: idPartida }).whereNot({ id: excetoPartidaId }).first('id');
  return outra !== undefined;
}

/**
 * Correção do ID (D16, 5b): a partida passa a ter o ID novo e volta para a fila do zero, como uma
 * partida recém-importada. As participações do ID antigo saem: eram de outra consulta ao site.
 * id_partida_planilha não muda: continua sendo o ID da planilha, mesmo depois de várias correções.
 * Se a partida estava em consulta, em_consulta_desde fica nulo e o recibo do job não vale mais
 * (4b): o resultado do ID antigo é descartado.
 */
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
