/**
 * Percentuais por posição no formulário do torneio. A conta ao vivo só ajuda a Maria a acertar
 * antes de enviar: quem decide é a API, com erroDosPercentuais (D20). As frases são as mesmas.
 */

export interface LeituraPercentuais {
  /** Os percentuais prontos para enviar, ou null enquanto houver erro. */
  valores: number[] | null;
  /** A soma dos campos preenchidos, ou null se algum não for número inteiro. */
  soma: number | null;
  erro: string | null;
}

export function lerPercentuais(textos: string[]): LeituraPercentuais {
  const limpos = textos.map((t) => t.trim());
  if (limpos.some((t) => t !== '' && !/^\d+$/.test(t))) {
    return { valores: null, soma: null, erro: 'Os percentuais precisam ser números inteiros, como 50, 30 e 20.' };
  }

  const numeros = limpos.map((t) => (t === '' ? null : Number(t)));
  const soma = numeros.reduce<number>((total, n) => total + (n ?? 0), 0);

  const vazio = numeros.indexOf(null);
  if (vazio >= 0) return { valores: null, soma, erro: `Preencha o percentual do ${vazio + 1}º lugar.` };
  if (soma !== 100) return { valores: null, soma, erro: `Os percentuais precisam somar 100. Hoje somam ${soma}.` };
  return { valores: numeros as number[], soma, erro: null };
}

/** [50, 30, 20] -> "1º 50% · 2º 30% · 3º 20%". */
export function resumoDosPercentuais(percentuais: number[]): string {
  return percentuais.map((pct, i) => `${i + 1}º ${pct}%`).join(' · ');
}
