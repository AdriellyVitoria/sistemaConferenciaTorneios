export const BLOQUEIO_TENTAR_AGORA_MS = 30_000;

export function segundosParaTentarAgora(ultimoClique: Date | null, agora: Date, bloqueioMs = BLOQUEIO_TENTAR_AGORA_MS): number {
  if (!ultimoClique) return 0;
  const passados = Math.max(0, agora.getTime() - ultimoClique.getTime());
  return Math.max(0, Math.ceil((bloqueioMs - passados) / 1000));
}
