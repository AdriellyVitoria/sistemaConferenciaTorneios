import { describe, expect, it } from 'vitest';
import { INTERVALOS_PADRAO_MS, proximaTentativa } from '../../src/dominio/novas-tentativas';

const AGORA = new Date('2026-10-14T09:00:00.000Z');
const MINUTO = 60_000;
const depoisDe = (ms: number) => new Date(AGORA.getTime() + ms);

describe('proximaTentativa: quando consultar de novo depois de o site falhar (D10)', () => {
  it('o padrão é 1, 2, 5 e 10 minutos', () => {
    expect(INTERVALOS_PADRAO_MS).toEqual([1 * MINUTO, 2 * MINUTO, 5 * MINUTO, 10 * MINUTO]);
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 5],
    [4, 10],
  ])('depois da %iª falha, espera %i minuto(s)', (falhas, minutos) => {
    expect(proximaTentativa(AGORA, falhas)).toEqual(depoisDe(minutos * MINUTO));
  });

  it('depois disso, a cada 10 minutos, sem limite de tentativas', () => {
    for (const falhas of [5, 6, 10, 100, 10_000]) {
      expect(proximaTentativa(AGORA, falhas)).toEqual(depoisDe(10 * MINUTO));
    }
  });

  it('várias falhas seguidas: os horários das tentativas ficam 1, 3, 8, 18, 28 e 38 minutos depois da primeira', () => {
    let horario = AGORA;
    const minutosDesdeAPrimeira: number[] = [];
    for (let falhas = 1; falhas <= 6; falhas++) {
      horario = proximaTentativa(horario, falhas);
      minutosDesdeAPrimeira.push((horario.getTime() - AGORA.getTime()) / MINUTO);
    }
    expect(minutosDesdeAPrimeira).toEqual([1, 3, 8, 18, 28, 38]);
  });

  it('intervalos configuráveis: a demonstração usa segundos', () => {
    const demonstracao = [2_000, 4_000, 8_000];
    expect(proximaTentativa(AGORA, 1, demonstracao)).toEqual(depoisDe(2_000));
    expect(proximaTentativa(AGORA, 3, demonstracao)).toEqual(depoisDe(8_000));
    expect(proximaTentativa(AGORA, 50, demonstracao)).toEqual(depoisDe(8_000));
  });

  it('um intervalo só: sempre ele', () => {
    expect(proximaTentativa(AGORA, 1, [30_000])).toEqual(depoisDe(30_000));
    expect(proximaTentativa(AGORA, 7, [30_000])).toEqual(depoisDe(30_000));
  });

  it('não altera a data recebida', () => {
    const agora = new Date(AGORA);
    proximaTentativa(agora, 1);
    expect(agora).toEqual(AGORA);
  });

  it('recusa número de falhas que não é inteiro maior que zero', () => {
    for (const falhas of [0, -1, 1.5, Number.NaN]) {
      expect(() => proximaTentativa(AGORA, falhas)).toThrow('O número de falhas precisa ser um inteiro maior que zero');
    }
  });

  it('recusa lista de intervalos vazia ou com intervalo que não é inteiro positivo', () => {
    for (const intervalos of [[], [0], [60_000, -1], [1.5]]) {
      expect(() => proximaTentativa(AGORA, 1, intervalos)).toThrow('Os intervalos entre tentativas');
    }
  });
});
