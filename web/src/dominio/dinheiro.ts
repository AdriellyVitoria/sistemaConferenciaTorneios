export const PREMIO_MAXIMO_CENTAVOS = 4_294_967_295;

const FORMATO_INVALIDO = 'Escreva o prêmio em reais, como 10.000,00 (ponto para milhar, vírgula para centavos).';

const REAIS = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

export type LeituraReais = { ok: true; centavos: number } | { ok: false; mensagem: string };

export function lerReais(texto: string): LeituraReais {
  const limpo = texto.trim().replace(/^R\$\s*/, '');
  if (limpo === '') return { ok: false, mensagem: 'Informe o prêmio.' };

  const partes = REAIS.exec(limpo);
  if (!partes) return { ok: false, mensagem: FORMATO_INVALIDO };

  const reais = partes[1].replace(/\./g, '').replace(/^0+(?=\d)/, '');
  const grandeDemais = { ok: false, mensagem: `O prêmio pode ser de até ${formatarCentavos(PREMIO_MAXIMO_CENTAVOS)}.` } as const;
  if (reais.length > 10) return grandeDemais;

  const centavos = Number(reais) * 100 + Number((partes[2] ?? '').padEnd(2, '0'));
  return centavos > PREMIO_MAXIMO_CENTAVOS ? grandeDemais : { ok: true, centavos };
}

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

const ESPACO_QUE_NAO_QUEBRA = String.fromCharCode(0x00a0);

export function formatarCentavos(centavos: number): string {
  const reais = formatarReais(centavos);
  const simbolo = `R$${ESPACO_QUE_NAO_QUEBRA}`;
  return reais.startsWith('-') ? `-${simbolo}${reais.slice(1)}` : `${simbolo}${reais}`;
}
