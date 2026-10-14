/**
 * Demora de cada consulta, lida das variáveis de ambiente.
 * Padrão: de 2 a 10 segundos, como o site real. A demonstração pode usar uma demora curta,
 * por exemplo SITE_DEMORA_MIN_MS=200 e SITE_DEMORA_MAX_MS=800.
 */
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
