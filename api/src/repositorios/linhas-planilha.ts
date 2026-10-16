import type { Executor } from '../banco/conexao';
import type { LinhaPlanilha } from '../dominio/planilha';

export interface LinhaGuardada extends LinhaPlanilha {
  partidaId: number;
}

interface LinhaBanco {
  partida_id: number;
  numero_linha: number;
  data: string;
  rodada: number;
  id_partida: string;
  partida: string;
  time: string;
  nick: string;
  minutos: number;
  kills: number;
  venceu: number | null;
}

const POR_INSERT = 500;

export async function inserirLinhas(
  bd: Executor,
  torneioId: number,
  linhas: LinhaPlanilha[],
  partidaIds: Map<string, number>,
): Promise<void> {
  const registros = linhas.map((l) => {
    const partidaId = partidaIds.get(l.idPartida);
    if (partidaId === undefined) {
      throw new Error(`A linha ${l.numeroLinha} é da partida ${l.idPartida}, que não foi criada.`);
    }
    return {
      torneio_id: torneioId,
      partida_id: partidaId,
      numero_linha: l.numeroLinha,
      data: l.data,
      rodada: l.rodada,
      id_partida: l.idPartida,
      partida: l.partida,
      time: l.time,
      nick: l.nick,
      minutos: l.minutos,
      kills: l.kills,
      venceu: l.venceu,
    };
  });
  for (let i = 0; i < registros.length; i += POR_INSERT) {
    await bd('linhas_planilha').insert(registros.slice(i, i + POR_INSERT));
  }
}

export async function listarLinhas(bd: Executor, torneioId: number): Promise<LinhaGuardada[]> {
  const linhas: LinhaBanco[] = await bd('linhas_planilha').where({ torneio_id: torneioId }).orderBy('numero_linha');
  return linhas.map((l) => ({
    numeroLinha: l.numero_linha,
    data: l.data,
    rodada: l.rodada,
    idPartida: l.id_partida,
    partida: l.partida,
    time: l.time,
    nick: l.nick,
    minutos: l.minutos,
    kills: l.kills,
    venceu: l.venceu === null ? null : Boolean(l.venceu),
    partidaId: l.partida_id,
  }));
}
