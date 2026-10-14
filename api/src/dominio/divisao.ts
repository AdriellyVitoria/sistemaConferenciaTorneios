/**
 * Divisão de um valor em centavos pelo método do maior resto (D9). Uma regra só no sistema todo:
 * entre as posições do pódio (pesos = percentuais, D20), entre times empatados (pesos iguais) e
 * dentro do time (pesos = minutos ou kills).
 *
 * 1. Cada um recebe a parte inteira do seu valor exato (total × peso ÷ soma dos pesos).
 * 2. Os centavos que sobram vão, um por vez, para quem tem a maior fração, ou seja, quem mais
 *    perdeu no corte. Empate na fração: ordem alfabética de dicionário do nome, ou a ordem da
 *    lista quando pedido (posições: a melhor colocada).
 * 3. A soma das partes é sempre exatamente o total.
 *
 * Tudo em inteiros, sem float em nenhum passo. Como todos dividem pela mesma soma, a fração de
 * cada um pode ser comparada pelo resto inteiro (total × peso mod soma).
 */

import { compararAlfabetico } from './texto';

/** A soma dos pesos é zero: não há proporção para dividir. O que fazer é regra de negócio (4c). */
export class SomaDosPesosZero extends Error {
  constructor(total: number) {
    super(`Não dá para dividir ${total} centavos: a soma dos pesos é zero.`);
    this.name = 'SomaDosPesosZero';
  }
}

export interface Participante {
  nome: string;
  peso: number;
}

export interface Parte {
  nome: string;
  /** Centavos. */
  valor: number;
  /** Recebeu 1 centavo além da parte inteira, para a soma fechar no total. */
  recebeuCentavo: boolean;
}

export interface OpcoesDivisao {
  /**
   * Quem leva o centavo quando as frações empatam:
   * - 'alfabetica' (padrão): ordem alfabética de dicionário do nome (jogadores, times empatados);
   * - 'ordem_da_lista': quem vem primeiro na lista (posições do pódio: a melhor colocada).
   */
  desempate?: 'alfabetica' | 'ordem_da_lista';
}

export function dividirMaiorResto(
  total: number,
  participantes: Participante[],
  { desempate = 'alfabetica' }: OpcoesDivisao = {},
): Parte[] {
  exigirInteiroNaoNegativo(total, 'O valor a dividir');
  const nomes = new Set<string>();
  for (const { nome, peso } of participantes) {
    exigirInteiroNaoNegativo(peso, `O peso de "${nome}"`);
    if (nomes.has(nome)) throw new Error(`Participante repetido na divisão: "${nome}".`);
    nomes.add(nome);
  }

  // BigInt: inteiro sem limite de tamanho, para total × peso nunca estourar
  const totalB = BigInt(total);
  const somaPesos = participantes.reduce((soma, p) => soma + BigInt(p.peso), 0n);
  if (somaPesos === 0n) throw new SomaDosPesosZero(total);

  const contas = participantes.map((p, indice) => {
    const exato = totalB * BigInt(p.peso); // valor exato = exato ÷ somaPesos
    return { nome: p.nome, indice, inteiro: exato / somaPesos, resto: exato % somaPesos };
  });

  // centavos que sobraram depois de cada um levar a parte inteira (sempre menos que o número de participantes)
  const sobra = Number(totalB - contas.reduce((soma, c) => soma + c.inteiro, 0n));

  const ordemDoCentavo = [...contas].sort((a, b) => {
    if (a.resto !== b.resto) return a.resto > b.resto ? -1 : 1; // maior fração primeiro
    return desempate === 'ordem_da_lista' ? a.indice - b.indice : compararAlfabetico(a.nome, b.nome);
  });
  const recebem = new Set(ordemDoCentavo.slice(0, sobra).map((c) => c.nome));

  return contas.map((c) => ({
    nome: c.nome,
    valor: Number(c.inteiro) + (recebem.has(c.nome) ? 1 : 0),
    recebeuCentavo: recebem.has(c.nome),
  }));
}

function exigirInteiroNaoNegativo(valor: number, descricao: string) {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new Error(`${descricao} precisa ser um inteiro não negativo: ${valor}.`);
  }
}
