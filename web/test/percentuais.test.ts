import { describe, expect, it } from 'vitest';
import { lerPercentuais, resumoDosPercentuais } from '../src/dominio/percentuais';

// A conta ao vivo é só uma ajuda na tela: a validação que vale é a da API (D20).
describe('lerPercentuais: a soma ao vivo do formulário', () => {
  it('50/30/20 soma 100 e está pronto para enviar', () => {
    expect(lerPercentuais(['50', '30', '20'])).toEqual({ valores: [50, 30, 20], soma: 100, erro: null });
  });

  it('aceita espaços em volta e uma posição só com 100', () => {
    expect(lerPercentuais([' 100 '])).toEqual({ valores: [100], soma: 100, erro: null });
  });

  it('soma diferente de 100 usa a mesma frase da API (D20)', () => {
    expect(lerPercentuais(['50', '30'])).toEqual({
      valores: null,
      soma: 80,
      erro: 'Os percentuais precisam somar 100. Hoje somam 80.',
    });
    expect(lerPercentuais(['50', '30', '30']).erro).toBe('Os percentuais precisam somar 100. Hoje somam 110.');
  });

  it('campo vazio diz qual posição falta e soma só os preenchidos', () => {
    expect(lerPercentuais(['50', '', '20'])).toEqual({
      valores: null,
      soma: 70,
      erro: 'Preencha o percentual do 2º lugar.',
    });
  });

  it.each([['20,5'], ['20.5'], ['-20'], ['vinte'], ['1e2']])('"%s" não é inteiro: mesma frase da API', (texto) => {
    expect(lerPercentuais(['50', '30', texto])).toEqual({
      valores: null,
      soma: null,
      erro: 'Os percentuais precisam ser números inteiros, como 50, 30 e 20.',
    });
  });

  it('0% numa posição é aceito (a posição fica sem prêmio)', () => {
    expect(lerPercentuais(['100', '0'])).toEqual({ valores: [100, 0], soma: 100, erro: null });
  });
});

describe('resumoDosPercentuais', () => {
  it('escreve como no cartão do torneio', () => {
    expect(resumoDosPercentuais([50, 30, 20])).toBe('1º 50% · 2º 30% · 3º 20%');
    expect(resumoDosPercentuais([100])).toBe('1º 100%');
  });
});
