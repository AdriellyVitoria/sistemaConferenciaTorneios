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

/**
 * @param idInternoDaPartida o id da partida no banco, que NÃO muda quando a Maria corrige o ID
 *   (5b). Só a duplicata o usa: ela vem da planilha, então o Ciente continua depois da correção,
 *   desde que o site mostre o mesmo valor para o jogador (o valor do site está na chave, porque a
 *   duplicata é o único lugar onde a Maria vê esse valor: a D19 não gera divergência para ele).
 *   As outras pendências usam o ID consultado no site: com um ID novo, é outra consulta, e o Ciente
 *   precisa ser dado de novo.
 */
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
    // sort() padrão (pelo código de cada caractere), e não localeCompare: o resultado não pode
    // depender da versão das regras de idioma, senão a chave mudaria numa atualização do Node
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
