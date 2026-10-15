/**
 * Dinheiro na tela. A API só recebe centavos inteiros (R$ 10.000,00 = 1000000); a Maria digita
 * em reais, no formato brasileiro. A conversão usa só texto e inteiros: dinheiro nunca passa por float.
 */

/** O maior prêmio que a coluna do banco guarda (INT UNSIGNED), o mesmo limite da API. */
export const PREMIO_MAXIMO_CENTAVOS = 4_294_967_295;

const FORMATO_INVALIDO = 'Escreva o prêmio em reais, como 10.000,00 (ponto para milhar, vírgula para centavos).';

// reais com pontos de milhar em grupos de 3 (10.000) ou sem pontos (10000); vírgula e 1 ou 2 dígitos de centavos
const REAIS = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

export type LeituraReais = { ok: true; centavos: number } | { ok: false; mensagem: string };

/** "R$ 10.000,00", "10.000,00", "10000" ou "10000,5" -> centavos. */
export function lerReais(texto: string): LeituraReais {
  const limpo = texto.trim().replace(/^R\$\s*/, '');
  if (limpo === '') return { ok: false, mensagem: 'Informe o prêmio.' };

  const partes = REAIS.exec(limpo);
  if (!partes) return { ok: false, mensagem: FORMATO_INVALIDO };

  const reais = partes[1].replace(/\./g, '').replace(/^0+(?=\d)/, '');
  const grandeDemais = { ok: false, mensagem: `O prêmio pode ser de até ${formatarCentavos(PREMIO_MAXIMO_CENTAVOS)}.` } as const;
  // mais de 10 dígitos já passa do limite; cortar aqui evita número grande demais para ser exato
  if (reais.length > 10) return grandeDemais;

  const centavos = Number(reais) * 100 + Number((partes[2] ?? '').padEnd(2, '0'));
  return centavos > PREMIO_MAXIMO_CENTAVOS ? grandeDemais : { ok: true, centavos };
}

/** 1000000 -> "10.000,00": o formato do campo, que lerReais lê de volta. */
export function formatarReais(centavos: number): string {
  if (!Number.isSafeInteger(centavos)) {
    throw new Error(`Valor em centavos precisa ser inteiro: ${centavos}`);
  }
  const sinal = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  const resto = absoluto % 100;
  const reais = (absoluto - resto) / 100;
  const reaisComPontos = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sinal}${reaisComPontos},${String(resto).padStart(2, '0')}`;
}

/**
 * O espaço que não quebra (U+00A0), escrito com o código do caractere: no código, o próprio
 * caractere é invisível e igual ao espaço comum (R2b).
 */
const ESPACO_QUE_NAO_QUEBRA = String.fromCharCode(0x00a0);

/**
 * 1000000 -> "R$ 10.000,00". Entre "R$" e o número vai um espaço que não quebra (R2b): numa tabela
 * estreita no celular, "R$" nunca fica sozinho no fim de uma linha com o valor na seguinte. É o que o
 * Intl.NumberFormat do navegador também faz. Para ler, copiar e colar, não muda nada.
 */
export function formatarCentavos(centavos: number): string {
  const reais = formatarReais(centavos);
  const simbolo = `R$${ESPACO_QUE_NAO_QUEBRA}`;
  return reais.startsWith('-') ? `-${simbolo}${reais.slice(1)}` : `${simbolo}${reais}`;
}
