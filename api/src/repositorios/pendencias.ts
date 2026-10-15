/**
 * O que a lista de pendências precisa do banco (etapa 5a): as participações registradas pelo
 * site e os Cientes da Maria. As pendências não são gravadas; o serviço as calcula na hora.
 */

import type { Executor } from '../banco/conexao';
import type { JogadorSite } from '../dominio/comparacao';

export interface ParticipacaoGuardada extends JogadorSite {
  partidaId: number;
}

/** As participações de todas as partidas do torneio, na ordem em que o site as registrou. */
export async function listarParticipacoes(bd: Executor, torneioId: number): Promise<ParticipacaoGuardada[]> {
  const linhas: { partida_id: number; time: string; nick: string; minutos: number; kills: number }[] = await bd('participacoes as j')
    .join('partidas as p', 'p.id', 'j.partida_id')
    .where('p.torneio_id', torneioId)
    .select('j.partida_id', 'j.time', 'j.nick', 'j.minutos', 'j.kills')
    .orderBy('j.id');
  return linhas.map((l) => ({ partidaId: l.partida_id, time: l.time, nick: l.nick, minutos: l.minutos, kills: l.kills }));
}

/** Os Cientes do torneio: chave da pendência -> quando a Maria deu o Ciente. */
export async function listarCientes(bd: Executor, torneioId: number): Promise<Map<string, Date>> {
  const linhas: { chave: string; ciente_em: Date }[] = await bd('cientes').where({ torneio_id: torneioId }).select('chave', 'ciente_em');
  return new Map(linhas.map((l) => [l.chave, l.ciente_em]));
}

/** Marca o Ciente. Se já existe, fica como está (vale a hora do primeiro Ciente). */
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

/** Planilha nova (D22): a conferência recomeça do zero, e os Cientes também. */
export async function apagarCientesDoTorneio(bd: Executor, torneioId: number): Promise<void> {
  await bd('cientes').where({ torneio_id: torneioId }).del();
}
