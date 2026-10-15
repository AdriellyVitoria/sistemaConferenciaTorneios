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

/** 1000000 -> "R$ 10.000,00". Mesmo formato do formatarCentavos da API. */
export function formatarCentavos(centavos: number): string {
  const reais = formatarReais(centavos);
  return reais.startsWith('-') ? `-R$ ${reais.slice(1)}` : `R$ ${reais}`;
}
