/**
 * A chave de uma pendência (etapa 5a). O "Ciente" da Maria vale para aquela pendência exata:
 * se algum valor mudar (outro dado do site, outra linha na planilha, um ID corrigido), a chave
 * muda e o Ciente antigo não se aplica à pendência nova.
 *
 * Entram na chave: o tipo, a partida (ou a lista de partidas, nos itens do torneio todo), o
 * jogador, o campo e os dois valores, planilha e site. A mensagem NÃO entra: reescrever uma frase
 * no código não pode apagar os Cientes já dados. O resultado é o SHA-256 dos campos em JSON
 * (sem ambiguidade entre campos vizinhos), com a versão do formato na frente: 64 caracteres, do
 * mesmo tamanho sempre, para caber num índice único do banco.
 */

import { createHash } from 'node:crypto';
import type { ItemPendencia, TipoPendencia } from './comparacao';

const VERSAO_DA_CHAVE = 1;

export function chaveDaPendencia(item: ItemPendencia): string {
  const campos = [
    VERSAO_DA_CHAVE,
    item.tipo,
    item.idPartida,
    item.partidas ? [...item.partidas].sort() : null,
    item.nick ?? null,
    item.campo ?? null,
    item.valorPlanilha,
    item.valorSite,
  ];
  return createHash('sha256').update(JSON.stringify(campos)).digest('hex');
}

const BLOQUEANTES: readonly TipoPendencia[] = ['nao_encontrada', 'times_diferentes'];

/**
 * Bloqueante = só se resolve corrigindo o ID da partida (D4b, D5, D16); não aceita Ciente.
 * As outras aceitam Ciente, mas também seguram o cálculo enquanto não o recebem (D17).
 */
export const ehBloqueante = (item: ItemPendencia) => BLOQUEANTES.includes(item.tipo);
