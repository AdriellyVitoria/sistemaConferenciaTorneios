import { describe, expect, it } from 'vitest';
import { CRITERIO_DE_DESEMPATE, montarPaginaPublica } from '../../src/dominio/pagina-publica';
import type { ResultadoGravado } from '../../src/repositorios/resultado';

const time = (posicao: number, nome: string, vitorias: number, killsTime: number, premioCentavos: number, criterio: string | null = null) => ({
  posicao, time: nome, vitorias, killsTime, premioCentavos, criterio, recebeuCentavo: false,
});

const RESULTADO: ResultadoGravado = {
  calculadoEm: new Date('2026-10-15T13:05:00.000Z'),
  premioCentavos: 1_000_000,
  percentuais: [50, 30, 20],
  modoDivisao: 'minutos',
  times: [
    time(1, 'Lobos', 5, 353, 500_000),
    time(2, 'Corvos', 3, 368, 300_000, 'desempate por kills do time'),
    time(3, 'Falcões', 3, 310, 100_000, 'divisão igual (empate em vitórias e kills)'),
    time(3, 'Tubarões', 3, 310, 100_000, 'divisão igual (empate em vitórias e kills)'),
    time(5, 'Panteras', 1, 269, 0),
    time(6, 'Serpentes', 0, 249, 0),
  ],
  jogadores: [
    {
      time: 'Corvos', posicao: 2, nick: 'Tuca', minutos: 19, kills: 5, base: 19, baseTime: 865, baseUsada: 'minutos',
      premioCentavos: 6_590, recebeuCentavo: true, explicacao: null,
    },
  ],
};

describe('montarPaginaPublica (D11): só o que é do torneio e dos times', () => {
  it('nome, data, regras e classificação, exatamente estes campos', () => {
    expect(montarPaginaPublica('Torneio de Setembro/2026', RESULTADO)).toEqual({
      torneio: { nome: 'Torneio de Setembro/2026' },
      calculadoEm: new Date('2026-10-15T13:05:00.000Z'),
      regras: {
        premioCentavos: 1_000_000,
        percentuais: [50, 30, 20],
        modoDivisao: 'minutos',
        criterioDeDesempate: CRITERIO_DE_DESEMPATE,
      },
      classificacao: [
        { posicao: 1, time: 'Lobos', vitorias: 5, killsTime: 353, premioCentavos: 500_000, criterio: null },
        { posicao: 2, time: 'Corvos', vitorias: 3, killsTime: 368, premioCentavos: 300_000, criterio: 'desempate por kills do time' },
        { posicao: 3, time: 'Falcões', vitorias: 3, killsTime: 310, premioCentavos: 100_000, criterio: 'divisão igual (empate em vitórias e kills)' },
        { posicao: 3, time: 'Tubarões', vitorias: 3, killsTime: 310, premioCentavos: 100_000, criterio: 'divisão igual (empate em vitórias e kills)' },
        { posicao: 5, time: 'Panteras', vitorias: 1, killsTime: 269, premioCentavos: 0, criterio: null },
        { posicao: 6, time: 'Serpentes', vitorias: 0, killsTime: 249, premioCentavos: 0, criterio: null },
      ],
    });
  });

  it('nenhum nick nem valor de jogador', () => {
    const texto = JSON.stringify(montarPaginaPublica('Setembro', RESULTADO));
    expect(texto).not.toContain('Tuca');
    expect(texto).not.toContain('6590');
    expect(texto).not.toContain('jogadores');
  });

  it('o critério de desempate em texto simples, na ordem da D2', () => {
    expect(CRITERIO_DE_DESEMPATE).toBe(
      'Ganha a melhor posição quem tem mais vitórias. Empate em vitórias: fica na frente o time com mais kills no torneio. '
        + 'Empate também em kills: os prêmios das posições empatadas são somados e divididos igualmente entre os times; '
        + 'se sobrar centavo, ele vai para o time que mais perdeu no arredondamento e, se ainda empatar, pela ordem alfabética do nome do time.',
    );
  });
});
