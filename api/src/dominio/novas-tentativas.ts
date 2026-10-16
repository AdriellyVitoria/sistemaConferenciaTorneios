const MINUTO = 60_000;

export const INTERVALOS_PADRAO_MS: readonly number[] = [1 * MINUTO, 2 * MINUTO, 5 * MINUTO, 10 * MINUTO];

export function proximaTentativa(agora: Date, falhas: number, intervalos: readonly number[] = INTERVALOS_PADRAO_MS): Date {
  if (!Number.isSafeInteger(falhas) || falhas < 1) {
    throw new Error(`O número de falhas precisa ser um inteiro maior que zero. Veio ${falhas}.`);
  }
  if (intervalos.length === 0 || intervalos.some((ms) => !Number.isSafeInteger(ms) || ms <= 0)) {
    throw new Error(`Os intervalos entre tentativas precisam ser milissegundos inteiros e positivos. Veio [${intervalos.join(', ')}].`);
  }
  const intervalo = intervalos[Math.min(falhas, intervalos.length) - 1];
  return new Date(agora.getTime() + intervalo);
}
