/**
 * Quando consultar o site de novo depois de uma falha (D10). Função pura: o job da conferência
 * guarda o horário devolvido em partidas.proxima_tentativa_em.
 *
 * O intervalo cresce a cada falha seguida (1, 2, 5 e depois 10 minutos) e fica no último para
 * sempre: não há limite de tentativas, porque toda partida precisa ser conferida no site (D5).
 * Crescer o intervalo evita sobrecarregar um site que já está com problema.
 */

const MINUTO = 60_000;

/** O padrão da D10. A demonstração troca por intervalos de segundos (CONFERENCIA_INTERVALOS_MS). */
export const INTERVALOS_PADRAO_MS: readonly number[] = [1 * MINUTO, 2 * MINUTO, 5 * MINUTO, 10 * MINUTO];

/**
 * @param agora    horário da falha
 * @param falhas   quantas falhas seguidas a partida já teve, contando esta (a primeira é 1)
 * @param intervalos em milissegundos; depois do último, repete o último
 */
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
