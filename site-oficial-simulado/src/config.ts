export function lerDemora(ambiente: Record<string, string | undefined>): { minMs: number; maxMs: number } {
  const minMs = lerMs(ambiente, 'SITE_DEMORA_MIN_MS', 2_000);
  const maxMs = lerMs(ambiente, 'SITE_DEMORA_MAX_MS', 10_000);
  if (minMs > maxMs) {
    throw new Error(`O mínimo da demora (${minMs} ms) não pode ser maior que o máximo (${maxMs} ms).`);
  }
  return { minMs, maxMs };
}

function lerMs(ambiente: Record<string, string | undefined>, nome: string, padrao: number): number {
  const valor = ambiente[nome];
  if (valor === undefined || valor === '') return padrao;
  if (!/^\d+$/.test(valor)) throw new Error(`${nome} precisa ser um número inteiro de milissegundos: "${valor}".`);
  return Number(valor);
}
