import { describe, expect, it } from 'vitest';
import { regrasEmTexto } from '../src/dominio/publico';
import { comEspacosComuns } from './ajudantes/espacos';

const DESEMPATE = 'Ganha a melhor posição quem tem mais vitórias. Empate em vitórias: fica na frente o time com mais kills no torneio.';
const regras = (extra: Partial<Parameters<typeof regrasEmTexto>[0]> = {}) => ({
  premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' as const, criterioDeDesempate: DESEMPATE, ...extra,
});

describe('regrasEmTexto: as regras do torneio em texto simples, para o jogador', () => {
  it('setembro: prêmio, quantas posições são premiadas, minutos e o desempate', () => {
    expect(comEspacosComuns(regrasEmTexto(regras(), 6))).toEqual([
      { rotulo: 'Prêmio total', texto: 'R$ 10.000,00' },
      { rotulo: 'Divisão entre os times', texto: 'Premia 3 posições: 1º 50% · 2º 30% · 3º 20%. Os outros times não recebem prêmio.' },
      {
        rotulo: 'Dentro do time',
        texto: 'Proporcional aos minutos que cada jogador jogou, pelo registro oficial de cada partida. '
          + 'Os valores são arredondados para o centavo; o centavo que sobra vai para quem estava mais perto de recebê-lo.',
      },
      { rotulo: 'Desempate', texto: DESEMPATE },
    ]);
  });

  it('50/50: premia 2 posições', () => {
    expect(regrasEmTexto(regras({ percentuais: [50, 50] }), 6)[1].texto).toBe('Premia 2 posições: 1º 50% · 2º 50%. Os outros times não recebem prêmio.');
  });

  it('modo kills: proporcional às kills, e o que acontece quando o time não fez nenhuma (D21)', () => {
    expect(regrasEmTexto(regras({ modoDivisao: 'kills' }), 6)[2].texto).toBe(
      'Proporcional às kills de cada jogador, pelo registro oficial de cada partida. Se ninguém do time fez kills, o prêmio do time é dividido pelos minutos jogados. '
        + 'Os valores são arredondados para o centavo; o centavo que sobra vai para quem estava mais perto de recebê-lo.',
    );
  });

  it('todos os times premiados: sem a frase dos que não recebem', () => {
    expect(regrasEmTexto(regras({ percentuais: [60, 40] }), 2)[1].texto).toBe('Premia 2 posições: 1º 60% · 2º 40%.');
  });

  it('menos times do que posições premiadas (D24): explica para onde foi o valor das posições sem time', () => {
    expect(regrasEmTexto(regras(), 2)[1].texto).toBe(
      'Premia 3 posições: 1º 50% · 2º 30% · 3º 20%. O torneio teve menos times do que posições premiadas: '
        + 'o valor das posições sem time foi dividido igualmente entre todos os times.',
    );
  });
});
