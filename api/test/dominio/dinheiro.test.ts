import { describe, expect, it } from 'vitest';
import { formatarCentavos } from '../../src/dominio/dinheiro';

describe('formatarCentavos', () => {
  it('formata o prêmio total do torneio', () => {
    expect(formatarCentavos(1_000_000)).toBe('R$ 10.000,00');
  });

  it('mantém os centavos com dois dígitos', () => {
    expect(formatarCentavos(6_590)).toBe('R$ 65,90');
    expect(formatarCentavos(102_976)).toBe('R$ 1.029,76');
    expect(formatarCentavos(1)).toBe('R$ 0,01');
    expect(formatarCentavos(0)).toBe('R$ 0,00');
  });

  it('separa milhares de valores grandes', () => {
    expect(formatarCentavos(123_456_789)).toBe('R$ 1.234.567,89');
  });

  it('formata valores negativos', () => {
    expect(formatarCentavos(-150)).toBe('-R$ 1,50');
  });

  it('recusa valor que não é inteiro', () => {
    expect(() => formatarCentavos(10.5)).toThrow('inteiro');
  });
});
