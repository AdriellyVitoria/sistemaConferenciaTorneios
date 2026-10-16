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

function reais(centavos: number): string {
  const resto = centavos % 100;
  return `${(centavos - resto) / 100},${String(resto).padStart(2, '0')}`;
}

function celula(texto: string): string {
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
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

export function nomeDoArquivoCsv(nomeDoTorneio: string): string {
  const simples = normalizarNome(nomeDoTorneio).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return simples ? `resultado-${simples}.csv` : 'resultado.csv';
}

export function nomeDoArquivoCsvComAcentos(nomeDoTorneio: string): string {
  const limpo = nomeDoTorneio.replace(/[\\/:*?"<>|]+/g, '-').trim();
  return limpo ? `resultado-${limpo}.csv` : 'resultado.csv';
}
