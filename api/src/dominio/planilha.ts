/**
 * Leitura da planilha da Maria Clara (etapa 1, parte 1).
 *
 * Função pura: recebe os bytes do arquivo e devolve as linhas lidas ou TODOS os erros encontrados.
 * Só valida o formato. Duplicatas, nicks parecidos e a comparação com o site são da parte 2.
 */

import { normalizarNome } from './texto';

export interface LinhaPlanilha {
  /** Número da linha como a Maria vê no Excel (o cabeçalho é a linha 1). */
  numeroLinha: number;
  /** Data no formato aaaa-mm-dd, sem fuso horário. */
  data: string;
  rodada: number;
  /** Sempre com "#" na frente, como o jogo mostra: "#45659". */
  idPartida: string;
  partida: string;
  time: string;
  nick: string;
  minutos: number;
  kills: number;
  /** true = venceu, false = perdeu, null = sem informação (célula vazia). */
  venceu: boolean | null;
}

export interface ErroLeitura {
  /** Linha do Excel; ausente quando o problema é o arquivo todo. */
  linha?: number;
  /** Todas as linhas envolvidas, quando o problema é de mais de uma (ex.: uma partida inteira, D23). */
  linhas?: number[];
  /** Nome da coluna como aparece na planilha da Maria. */
  coluna?: string;
  /** O valor que veio na célula, para a tela mostrar. */
  valor?: string;
  /** Frase para a Maria, em português simples. */
  mensagem: string;
}

export type ResultadoLeitura =
  | { ok: true; linhas: LinhaPlanilha[]; separador: ';' | ','; convertidoDeWindows1252: boolean }
  | { ok: false; erros: ErroLeitura[]; convertidoDeWindows1252: boolean };

type Chave = 'data' | 'rodada' | 'idPartida' | 'partida' | 'time' | 'nick' | 'minutos' | 'kills' | 'venceu';

const COLUNAS: { chave: Chave; nome: string }[] = [
  { chave: 'data', nome: 'Data' },
  { chave: 'rodada', nome: 'Rodada' },
  { chave: 'idPartida', nome: 'ID Partida' },
  { chave: 'partida', nome: 'Partida' },
  { chave: 'time', nome: 'Time' },
  { chave: 'nick', nome: 'Nick' },
  { chave: 'minutos', nome: 'Minutos' },
  { chave: 'kills', nome: 'Kills' },
  { chave: 'venceu', nome: 'Venceu?' },
];

/**
 * Limites da entrada, num lugar só (code review, itens 2 e 13). Usados pela leitura da planilha e
 * pela correção do ID (validarIdPartida). Os de texto e o da rodada acompanham as colunas do banco
 * (migrations 003 e 004): o MySQL em modo estrito recusaria o INSERT, e a Maria veria um erro 500
 * sem a linha do Excel. Se uma coluna mudar de tamanho, o limite aqui muda junto.
 */
export const LIMITES = {
  /** nick e time: VARCHAR(80) */
  nick: 80,
  time: 80,
  /** coluna "Partida": VARCHAR(200) */
  partida: 200,
  /** id_partida: VARCHAR(20), com o "#" na frente */
  digitosIdPartida: 19,
  /** nenhuma partida chega perto disso; também cabe com folga no INT UNSIGNED */
  minutosEKills: 100_000,
  /** só a capacidade da coluna (INT UNSIGNED): limite técnico, não regra de negócio */
  rodada: 4_294_967_295,
  /** "01/09/0226" (um "2" no lugar errado) não passa */
  anoMinimo: 2000,
  anoMaximo: 2100,
} as const;

const SEM_PARTIDAS = 'A planilha não tem nenhuma partida.';

/** Um .xlsx é um arquivo ZIP: começa com os bytes "PK", 3 e 4 (code review, item 12). */
const ASSINATURA_ZIP = [0x50, 0x4b, 0x03, 0x04];
const ARQUIVO_DO_EXCEL =
  'Este arquivo é do Excel (.xlsx). No Excel, use Salvar como → CSV UTF-8 (separado por vírgulas).';

export function lerPlanilha(conteudo: Uint8Array): ResultadoLeitura {
  // sem isso, o .xlsx seria lido como texto em Windows-1252 e daria nove "Falta a coluna"
  if (ASSINATURA_ZIP.every((byte, i) => conteudo[i] === byte)) {
    return { ok: false, erros: [{ mensagem: ARQUIVO_DO_EXCEL }], convertidoDeWindows1252: false };
  }

  const { texto, convertidoDeWindows1252 } = decodificar(conteudo);
  const recusar = (erros: ErroLeitura[]): ResultadoLeitura => ({ ok: false, erros, convertidoDeWindows1252 });

  const separador = detectarSeparador(texto);
  const registros = separarRegistros(texto, separador);
  if (registros.length === 0) return recusar([{ mensagem: SEM_PARTIDAS }]);

  const cabecalho = lerCabecalho(registros[0]);
  if (!cabecalho.ok) return recusar(cabecalho.erros);

  const linhas: LinhaPlanilha[] = [];
  const erros: ErroLeitura[] = [];
  registros.slice(1).forEach((campos, indice) => {
    if (campos.every((c) => c.trim() === '')) return; // linha vazia ou só com separadores
    const numeroLinha = indice + 2;
    const celula = (chave: Chave) => (campos[cabecalho.posicao[chave]] ?? '').trim();
    const resultado = lerLinha(numeroLinha, celula);
    if (resultado.ok) linhas.push(resultado.linha);
    else erros.push(...resultado.erros);
  });

  if (erros.length) return recusar(erros);
  if (linhas.length === 0) return recusar([{ mensagem: SEM_PARTIDAS }]);
  return { ok: true, linhas, separador, convertidoDeWindows1252 };
}

// ------------------------------------------------------------------ arquivo

/**
 * Tenta UTF-8 (com ou sem BOM). Se os bytes não forem UTF-8 válido, converte de Windows-1252,
 * que é o que o Excel brasileiro grava na opção "CSV (separado por vírgulas)".
 */
function decodificar(bytes: Uint8Array): { texto: string; convertidoDeWindows1252: boolean } {
  let texto: string;
  let convertidoDeWindows1252 = false;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder('windows-1252').decode(bytes);
    convertidoDeWindows1252 = true;
  }
  return { texto: texto.replace(/^﻿/, ''), convertidoDeWindows1252 };
}

/** D14: o separador é o da linha de cabeçalho. */
function detectarSeparador(texto: string): ';' | ',' {
  const primeiraLinha = texto.split(/\r?\n|\r/, 1)[0] ?? '';
  return primeiraLinha.includes(';') ? ';' : ',';
}

/**
 * Quebra o texto em registros e campos no padrão CSV: aceita CRLF e LF e respeita aspas
 * ("Lua, a Rainha" num arquivo com vírgula; "" dentro de aspas vira uma aspa).
 * Cada registro corresponde a uma linha do Excel.
 */
function separarRegistros(texto: string, separador: string): string[][] {
  const registros: string[][] = [];
  let registro: string[] = [];
  let campo = '';
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c !== '"') campo += c;
      else if (texto[i + 1] === '"') { campo += '"'; i++; }
      else entreAspas = false;
    } else if (c === '"' && campo.trim() === '') {
      entreAspas = true;
      campo = '';
    } else if (c === separador) {
      registro.push(campo);
      campo = '';
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      registro.push(campo);
      registros.push(registro);
      registro = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo !== '' || registro.length > 0) {
    registro.push(campo);
    registros.push(registro);
  }
  return registros;
}

// ---------------------------------------------------------------- cabeçalho

/** Compara nomes de coluna sem acento, sem maiúsculas, sem espaços extras e sem o "?" final. */
function normalizarNomeColuna(nome: string): string {
  return normalizarNome(nome).replace(/\?$/, '').trimEnd();
}

function lerCabecalho(
  campos: string[],
): { ok: true; posicao: Record<Chave, number> } | { ok: false; erros: ErroLeitura[] } {
  const nomes = campos.map(normalizarNomeColuna);
  const erros: ErroLeitura[] = [];
  const posicao = {} as Record<Chave, number>;

  for (const { chave, nome } of COLUNAS) {
    const alvo = normalizarNomeColuna(nome);
    const encontradas = nomes.flatMap((n, i) => (n === alvo ? [i] : []));
    if (encontradas.length === 0) {
      erros.push({ linha: 1, coluna: nome, mensagem: `Falta a coluna "${nome}" na planilha.` });
    } else if (encontradas.length > 1) {
      erros.push({ linha: 1, coluna: nome, mensagem: `A coluna "${nome}" aparece mais de uma vez.` });
    } else {
      posicao[chave] = encontradas[0];
    }
  }
  return erros.length ? { ok: false, erros } : { ok: true, posicao };
}

// -------------------------------------------------------------------- linha

/** Resultado da leitura de uma célula: o valor convertido ou a mensagem para a Maria. */
type Lido<T> = { ok: true; valor: T } | { ok: false; mensagem: string };
const valido = <T>(valor: T): Lido<T> => ({ ok: true, valor });
const invalido = (mensagem: string): Lido<never> => ({ ok: false, mensagem });

function lerLinha(
  numeroLinha: number,
  celula: (chave: Chave) => string,
): { ok: true; linha: LinhaPlanilha } | { ok: false; erros: ErroLeitura[] } {
  const erros: ErroLeitura[] = [];

  // lê uma célula; se for inválida, guarda o erro e segue, para juntar todos os erros da linha
  function ler<T>(chave: Chave, leitor: (texto: string) => Lido<T>): T {
    const lido = leitor(celula(chave));
    if (lido.ok) return lido.valor;
    const coluna = COLUNAS.find((c) => c.chave === chave)!.nome;
    erros.push({ linha: numeroLinha, coluna, valor: celula(chave), mensagem: lido.mensagem });
    return undefined as T;
  }

  const linha: LinhaPlanilha = {
    numeroLinha,
    data: ler('data', lerData),
    rodada: ler('rodada', lerRodada),
    idPartida: ler('idPartida', lerIdPartida),
    partida: ler('partida', textoAte(LIMITES.partida, 'A coluna Partida pode ter', 'Esta tem')),
    time: ler('time', obrigatorio('O time está vazio.', textoAte(LIMITES.time, 'O nome do time pode ter', 'Este tem'))),
    nick: ler('nick', obrigatorio('O nick está vazio.', textoAte(LIMITES.nick, 'O nick pode ter', 'Este tem'))),
    minutos: ler('minutos', lerMinutos),
    kills: ler('kills', lerKills),
    venceu: ler('venceu', lerVenceu),
  };
  return erros.length ? { ok: false, erros } : { ok: true, linha };
}

const obrigatorio = (mensagemSeVazio: string, depois: (texto: string) => Lido<string>) => (texto: string): Lido<string> =>
  texto === '' ? invalido(mensagemSeVazio) : depois(texto);

/**
 * Texto com no máximo `limite` caracteres, contados como o MySQL conta: por caractere, e não pelo
 * .length do JavaScript (que conta um emoji como 2).
 */
const textoAte = (limite: number, comeco: string, este: string) => (texto: string): Lido<string> => {
  const caracteres = [...texto].length;
  return caracteres > limite ? invalido(`${comeco} até ${limite} caracteres. ${este} ${caracteres}.`) : valido(texto);
};

/** 100000 -> "100.000", para as frases (sem depender do idioma do servidor). */
const comPontos = (numero: number) => String(numero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** dd/mm/aaaa (aceita d/m/aaaa) -> aaaa-mm-dd. */
function lerData(texto: string): Lido<string> {
  if (texto === '') return invalido('A data está vazia. Use o formato dd/mm/aaaa, como 05/09/2026.');
  const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto);
  if (!partes) return invalido(`A data precisa estar no formato dd/mm/aaaa, como 05/09/2026. Veio "${texto}".`);

  const [dia, mes, ano] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  if (ano < LIMITES.anoMinimo || ano > LIMITES.anoMaximo) {
    return invalido(`O ano da data precisa estar entre ${LIMITES.anoMinimo} e ${LIMITES.anoMaximo}. Veio "${texto}".`);
  }
  // dia 0 do mês seguinte = último dia deste mês (em UTC, para não depender do fuso)
  const diasNoMes = mes >= 1 && mes <= 12 ? new Date(Date.UTC(ano, mes, 0)).getUTCDate() : 0;
  if (dia < 1 || dia > diasNoMes) return invalido(`A data "${texto}" não existe no calendário.`);

  return valido(`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
}

/** Inteiro não negativo escrito só com dígitos; qualquer outra coisa é null. */
function inteiroNaoNegativo(texto: string): number | null {
  if (!/^\d+$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isSafeInteger(numero) ? numero : null;
}

function lerRodada(texto: string): Lido<number> {
  if (texto === '') return invalido('A rodada está vazia.');
  // só dígitos, mas além do que a coluna guarda (ou além do inteiro seguro do JavaScript)
  if (/^\d+$/.test(texto) && (inteiroNaoNegativo(texto) ?? Infinity) > LIMITES.rodada) {
    return invalido(`A rodada é grande demais. Veio "${texto}".`);
  }
  const numero = inteiroNaoNegativo(texto);
  if (numero === null || numero === 0) {
    return invalido(`A rodada precisa ser um número inteiro maior que zero, como 1. Veio "${texto}".`);
  }
  return valido(numero);
}

/**
 * O ID da partida com as mesmas regras da importação (D18): aceita "#45659", "45659" e espaços
 * em volta; devolve sempre "#45659". Usado também na correção do ID (5b).
 */
export function validarIdPartida(texto: string): { ok: true; idPartida: string } | { ok: false; mensagem: string } {
  const lido = lerIdPartida(texto.trim());
  return lido.ok ? { ok: true, idPartida: lido.valor } : { ok: false, mensagem: lido.mensagem };
}

function lerIdPartida(texto: string): Lido<string> {
  if (texto === '') return invalido('O ID da partida está vazio.');
  const digitos = texto.replace(/^#\s*/, '');
  if (!/^\d+$/.test(digitos)) {
    return invalido(`O ID da partida precisa ter só números, como #45659. Veio "${texto}".`);
  }
  if (digitos.length > LIMITES.digitosIdPartida) {
    return invalido(`O ID da partida pode ter até ${LIMITES.digitosIdPartida} números. Veio "${texto}", com ${digitos.length}.`);
  }
  return valido(`#${digitos}`);
}

/** Minutos ou kills: inteiro de 0 a LIMITES.minutosEKills. As frases mudam só no começo. */
function lerQuantidade(
  texto: string,
  { vazio, negativo, comoNumero, faixa }: { vazio: string; negativo: string; comoNumero: string; faixa: string },
): Lido<number> {
  if (texto === '') return invalido(vazio);
  if (/^-\d+$/.test(texto)) return invalido(`${negativo} Veio "${texto}".`);
  if (!/^\d+$/.test(texto)) return invalido(`${comoNumero} Veio "${texto}".`);
  // só dígitos: acima do limite, ou longo demais até para o JavaScript, é a mesma frase de faixa
  const numero = inteiroNaoNegativo(texto);
  if (numero === null || numero > LIMITES.minutosEKills) return invalido(`${faixa} Veio "${texto}".`);
  return valido(numero);
}

const lerMinutos = (texto: string) => lerQuantidade(texto, {
  vazio: 'Os minutos estão vazios. Preencha com os minutos jogados (pode ser 0).',
  negativo: 'Os minutos não podem ser negativos.',
  comoNumero: 'Os minutos precisam ser um número inteiro, como 43.',
  faixa: `Os minutos precisam estar entre 0 e ${comPontos(LIMITES.minutosEKills)}.`,
});

const lerKills = (texto: string) => lerQuantidade(texto, {
  vazio: 'As kills estão vazias. Preencha com as kills do jogador (pode ser 0).',
  negativo: 'As kills não podem ser negativas.',
  comoNumero: 'As kills precisam ser um número inteiro, como 14.',
  faixa: `As kills precisam estar entre 0 e ${comPontos(LIMITES.minutosEKills)}.`,
});

/** "sim" -> true; "não"/"nao" -> false; vazio -> null. Ignora maiúsculas (os espaços já saíram). */
function lerVenceu(texto: string): Lido<boolean | null> {
  const normalizado = texto.normalize('NFC').toLowerCase();
  if (normalizado === '') return valido(null);
  if (normalizado === 'sim') return valido(true);
  if (normalizado === 'não' || normalizado === 'nao') return valido(false);
  return invalido(`O "Venceu?" precisa ser sim, não ou ficar vazio. Veio "${texto}".`);
}
