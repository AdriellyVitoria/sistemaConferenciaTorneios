import { compararAlfabetico } from './texto';

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
  valor: number;
  recebeuCentavo: boolean;
}

export interface OpcoesDivisao {
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

  const totalB = BigInt(total);
  const somaPesos = participantes.reduce((soma, p) => soma + BigInt(p.peso), 0n);
  if (somaPesos === 0n) throw new SomaDosPesosZero(total);

  const contas = participantes.map((p, indice) => {
    const exato = totalB * BigInt(p.peso);
    return { nome: p.nome, indice, inteiro: exato / somaPesos, resto: exato % somaPesos };
  });

  const sobra = Number(totalB - contas.reduce((soma, c) => soma + c.inteiro, 0n));

  const ordemDoCentavo = [...contas].sort((a, b) => {
    if (a.resto !== b.resto) return a.resto > b.resto ? -1 : 1;
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
