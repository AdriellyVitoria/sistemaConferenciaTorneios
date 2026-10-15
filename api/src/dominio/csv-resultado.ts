/**
 * O CSV do resultado, para a Maria pagar no Excel (etapa 6c). Função pura: recebe os jogadores
 * gravados no cálculo e devolve o texto. Quem acrescenta o BOM é a rota.
 *
 * - Separador ";" e linhas CRLF: o que o Excel em português espera.
 * - Valor em reais com vírgula e sem ponto de milhar ("1000,00", "65,90"): o Excel em português
 *   lê como número, e a Maria consegue somar a coluna. Dinheiro só com inteiros, sem float.
 * - Sem linha de total: somar a coluna contaria o total duas vezes.
 * - Ordem: posição, depois o valor maior, depois o nick.
 * - Texto que começa com =, +, - ou @ ganha um apóstrofo: senão o Excel executa como fórmula.
 * - Coluna "Pago" vazia no final, para a Maria marcar no Excel: o sistema não controla pagamento (D12).
 */

import { compararAlfabetico, normalizarNome } from './texto';

export interface JogadorDoCsv {
  posicao: number;
  time: string;
  nick: string;
  minutos: number;
  kills: number;
  premioCentavos: number;
  recebeuCentavo: boolean;
}

const CABECALHO = ['Posição', 'Time', 'Nick', 'Minutos', 'Kills', 'Valor (R$)', 'Centavo de arredondamento', 'Pago'];

/** 6590 -> "65,90"; 100000 -> "1000,00". */
function reais(centavos: number): string {
  const resto = centavos % 100;
  return `${(centavos - resto) / 100},${String(resto).padStart(2, '0')}`;
}

function celula(texto: string): string {
  const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function csvDoResultado(jogadores: JogadorDoCsv[]): string {
  const ordenados = [...jogadores].sort(
    (a, b) => a.posicao - b.posicao || b.premioCentavos - a.premioCentavos || compararAlfabetico(a.nick, b.nick) || compararAlfabetico(a.time, b.time),
  );
  const linhas = [
    CABECALHO.join(';'),
    ...ordenados.map((j) =>
      [String(j.posicao), celula(j.time), celula(j.nick), String(j.minutos), String(j.kills), reais(j.premioCentavos), j.recebeuCentavo ? 'sim' : 'não', ''].join(';'),
    ),
  ];
  return `${linhas.join('\r\n')}\r\n`;
}

/**
 * "Torneio de Setembro/2026" -> "resultado-torneio-de-setembro-2026.csv". Só letras sem acento,
 * números e hífen: funciona em qualquer navegador e sistema. O nome com acentos vai à parte,
 * no cabeçalho (filename*), para os navegadores que entendem.
 */
export function nomeDoArquivoCsv(nomeDoTorneio: string): string {
  const simples = normalizarNome(nomeDoTorneio).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return simples ? `resultado-${simples}.csv` : 'resultado.csv';
}

/** O nome com acentos para o filename*: só tira o que não pode estar num nome de arquivo. */
export function nomeDoArquivoCsvComAcentos(nomeDoTorneio: string): string {
  const limpo = nomeDoTorneio.replace(/[\\/:*?"<>|]+/g, '-').trim();
  return limpo ? `resultado-${limpo}.csv` : 'resultado.csv';
}
