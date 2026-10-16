import { createHash } from 'node:crypto';
import type { ItemPendencia, TipoPendencia } from './comparacao';

const VERSAO_DA_CHAVE = 1;

export function chaveDaPendencia(item: ItemPendencia, idInternoDaPartida?: number | null): string {
  let partida: unknown = item.idPartida;
  if (item.tipo === 'duplicata') {
    if (idInternoDaPartida == null) throw new Error('A chave da duplicata precisa do id interno da partida.');
    partida = { interna: idInternoDaPartida };
  }
  const campos = [
    VERSAO_DA_CHAVE,
    item.tipo,
    partida,
    item.partidas ? [...item.partidas].sort() : null,
    item.nick ?? null,
    item.campo ?? null,
    item.valorPlanilha,
    item.valorSite,
  ];
  return createHash('sha256').update(JSON.stringify(campos)).digest('hex');
}

const BLOQUEANTES: readonly TipoPendencia[] = ['nao_encontrada', 'times_diferentes'];

export const ehBloqueante = (item: ItemPendencia) => BLOQUEANTES.includes(item.tipo);
