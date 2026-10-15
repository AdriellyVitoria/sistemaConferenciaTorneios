import { describe, expect, it } from 'vitest';
import { BLOQUEIO_TENTAR_AGORA_MS, segundosParaTentarAgora } from '../../src/dominio/tentar-agora';

const CLIQUE = new Date('2026-10-14T09:00:00.000Z');
const depois = (ms: number) => new Date(CLIQUE.getTime() + ms);

describe('segundosParaTentarAgora: o bloqueio de 30 s entre cliques', () => {
  it('o bloqueio é de 30 s', () => {
    expect(BLOQUEIO_TENTAR_AGORA_MS).toBe(30_000);
  });

  it('nunca clicado: liberado', () => {
    expect(segundosParaTentarAgora(null, CLIQUE)).toBe(0);
  });

  it.each([
    [0, 30],
    [1, 30], // 29,999 s faltando: arredonda para cima, nunca mostra 0 antes da hora
    [999, 30],
    [1_000, 29],
    [12_500, 18],
    [29_001, 1],
    [30_000, 0],
    [45_000, 0],
  ])('%i ms depois do clique: faltam %i s', (passados, faltam) => {
    expect(segundosParaTentarAgora(CLIQUE, depois(passados))).toBe(faltam);
  });

  it('relógio voltou para antes do clique: ainda bloqueado, no máximo 30 s', () => {
    expect(segundosParaTentarAgora(CLIQUE, depois(-5_000))).toBe(30);
  });
});
