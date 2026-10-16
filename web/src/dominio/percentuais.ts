export interface LeituraPercentuais {
  valores: number[] | null;
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

export function resumoDosPercentuais(percentuais: number[]): string {
  return percentuais.map((pct, i) => `${i + 1}º ${pct}%`).join(' · ');
}
