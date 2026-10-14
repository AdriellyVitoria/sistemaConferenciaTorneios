import { describe, expect, it } from 'vitest';
import { formatarCentavos, formatarReais, lerReais } from '../src/dominio/dinheiro';

describe('lerReais: o prêmio digitado no formato brasileiro, em centavos inteiros', () => {
  it.each([
    ['10.000,00', 1_000_000],
    ['R$ 10.000,00', 1_000_000],
    ['R$10.000,00', 1_000_000],
    ['10000', 1_000_000],
    ['10000,00', 1_000_000],
    ['10.000', 1_000_000],
    ['10000,5', 1_000_050],
    ['1.234,57', 123_457],
    ['  1234,57  ', 123_457],
    ['0,01', 1],
    ['0', 0],
    ['1.000.000,00', 100_000_000],
  ])('"%s" vira %i centavos', (texto, centavos) => {
    expect(lerReais(texto)).toEqual({ ok: true, centavos });
  });

  it('vazio pede o prêmio', () => {
    expect(lerReais('')).toEqual({ ok: false, mensagem: 'Informe o prêmio.' });
    expect(lerReais('   ')).toEqual({ ok: false, mensagem: 'Informe o prêmio.' });
    expect(lerReais('R$ ')).toEqual({ ok: false, mensagem: 'Informe o prêmio.' });
  });

  it.each([
    ['10.000,001', 'mais de dois dígitos de centavos'],
    ['10,000.00', 'formato americano'],
    ['1.00', 'ponto que não separa milhar'],
    ['10.00.000', 'grupos de milhar errados'],
    ['1.0000', 'grupo de milhar com 4 dígitos'],
    ['-10', 'negativo'],
    ['dez mil', 'texto'],
    ['10.000,', 'vírgula sem centavos'],
    [',50', 'centavos sem reais'],
    ['1e4', 'notação científica'],
  ])('recusa "%s" (%s) explicando o formato', (texto) => {
    expect(lerReais(texto)).toEqual({
      ok: false,
      mensagem: 'Escreva o prêmio em reais, como 10.000,00 (ponto para milhar, vírgula para centavos).',
    });
  });

  it('recusa prêmio maior que o banco guarda (R$ 42.949.672,95), sem perder precisão com números enormes', () => {
    expect(lerReais('42.949.672,95')).toEqual({ ok: true, centavos: 4_294_967_295 });
    const grandeDemais = { ok: false, mensagem: 'O prêmio pode ser de até R$ 42.949.672,95.' };
    expect(lerReais('42.949.672,96')).toEqual(grandeDemais);
    expect(lerReais('99999999999999999999999')).toEqual(grandeDemais);
  });
});

describe('formatarCentavos e formatarReais', () => {
  it.each([
    [1_000_000, 'R$ 10.000,00', '10.000,00'],
    [123_457, 'R$ 1.234,57', '1.234,57'],
    [1, 'R$ 0,01', '0,01'],
    [0, 'R$ 0,00', '0,00'],
  ])('%i centavos', (centavos, comSimbolo, semSimbolo) => {
    expect(formatarCentavos(centavos)).toBe(comSimbolo);
    expect(formatarReais(centavos)).toBe(semSimbolo);
  });

  it('o que formatarReais escreve, lerReais lê de volta', () => {
    for (const centavos of [0, 1, 99, 100, 123_457, 1_000_000, 4_294_967_295]) {
      expect(lerReais(formatarReais(centavos))).toEqual({ ok: true, centavos });
    }
  });

  it('recusa valor que não é centavo inteiro', () => {
    expect(() => formatarCentavos(10.5)).toThrow();
  });
});
