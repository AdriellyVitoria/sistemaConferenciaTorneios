import type { Executor } from '../banco/conexao';
import type { JogadorSite } from '../dominio/comparacao';

export interface ParticipacaoGuardada extends JogadorSite {
  partidaId: number;
}

export async function listarParticipacoes(bd: Executor, torneioId: number): Promise<ParticipacaoGuardada[]> {
  const linhas: { partida_id: number; time: string; nick: string; minutos: number; kills: number }[] = await bd('participacoes as j')
    .join('partidas as p', 'p.id', 'j.partida_id')
    .where('p.torneio_id', torneioId)
    .select('j.partida_id', 'j.time', 'j.nick', 'j.minutos', 'j.kills')
    .orderBy('j.id');
  return linhas.map((l) => ({ partidaId: l.partida_id, time: l.time, nick: l.nick, minutos: l.minutos, kills: l.kills }));
}

export async function listarCientes(bd: Executor, torneioId: number): Promise<Map<string, Date>> {
  const linhas: { chave: string; ciente_em: Date }[] = await bd('cientes').where({ torneio_id: torneioId }).select('chave', 'ciente_em');
  return new Map(linhas.map((l) => [l.chave, l.ciente_em]));
}

export async function gravarCientes(bd: Executor, torneioId: number, chaves: string[], agora: Date): Promise<void> {
  if (chaves.length === 0) return;
  await bd('cientes')
    .insert(chaves.map((chave) => ({ torneio_id: torneioId, chave, ciente_em: agora })))
    .onConflict(['torneio_id', 'chave'])
    .ignore();
}

export async function apagarCiente(bd: Executor, torneioId: number, chave: string): Promise<void> {
  await bd('cientes').where({ torneio_id: torneioId, chave }).del();
}

export async function apagarCientesDoTorneio(bd: Executor, torneioId: number): Promise<void> {
  await bd('cientes').where({ torneio_id: torneioId }).del();
}
