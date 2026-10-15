/**
 * O bloqueio do "tentar agora" (etapa 4c). Entre um clique e outro, 30 s: o botão antecipa a
 * próxima consulta, mas não pode virar um jeito de martelar um site que já está com problema.
 */

export const BLOQUEIO_TENTAR_AGORA_MS = 30_000;

/**
 * Quantos segundos faltam para poder clicar de novo; 0 = liberado. Arredonda para cima: com
 * 0,5 s faltando, mostra 1, e nunca "0" antes da hora. Se o relógio voltou para antes do clique,
 * conta como clique de agora (no máximo 30 s), em vez de travar por mais tempo.
 */
export function segundosParaTentarAgora(ultimoClique: Date | null, agora: Date, bloqueioMs = BLOQUEIO_TENTAR_AGORA_MS): number {
  if (!ultimoClique) return 0;
  const passados = Math.max(0, agora.getTime() - ultimoClique.getTime());
  return Math.max(0, Math.ceil((bloqueioMs - passados) / 1000));
}
