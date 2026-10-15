import { describe, expect, it } from 'vitest';
import { centesimosDePercentual, montarPaginaDoTime, type ResultadoDoTime } from '../../src/dominio/pagina-do-time';

const time = (posicao: number, nome: string, vitorias: number, killsTime: number, premioCentavos: number, criterio: string | null = null) => ({
  posicao, time: nome, vitorias, killsTime, premioCentavos, criterio, recebeuCentavo: false,
});
const jogador = (nomeDoTime: string, nick: string, minutos: number, baseTime: number, premioCentavos: number, extra: { recebeuCentavo?: boolean; explicacao?: string | null } = {}) => ({
  time: nomeDoTime, nick, minutos, kills: 10, base: minutos, baseTime, baseUsada: 'minutos' as const,
  premioCentavos, recebeuCentavo: extra.recebeuCentavo ?? false, explicacao: extra.explicacao ?? null,
});

// o setembro gravado, com os jogadores de Corvos, Falcões e um de Lobos
const SETEMBRO: ResultadoDoTime = {
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
    jogador('Lobos', 'xXSniperXx', 211, 1055, 100_000),
    // na ordem em que o cálculo grava: a tela recebe por valor e nick
    jogador('Corvos', 'Tuca', 19, 865, 6_590, { recebeuCentavo: true }),
    jogador('Corvos', 'Zeca', 173, 865, 60_000),
    jogador('Corvos', 'Bia.gg', 154, 865, 53_410),
    jogador('Corvos', 'Corvinho', 173, 865, 60_000),
    jogador('Corvos', 'Nina.exe', 173, 865, 60_000),
    jogador('Corvos', 'M4theus', 173, 865, 60_000),
    ...['Dudu.pro', 'Falk', 'Kiwi', 'Marreta', 'Sol'].map((nick) => jogador('Falcões', nick, 180, 900, 20_000)),
  ],
};
const CODIGO_PUBLICO = 'P'.repeat(32);

describe('montarPaginaDoTime (D11): o extrato de um time premiado', () => {
  it('Corvos: o time, como foi calculado, os 6 jogadores e o total', () => {
    expect(montarPaginaDoTime('Torneio de Setembro/2026', SETEMBRO, 'Corvos', CODIGO_PUBLICO)).toEqual({
      torneio: { nome: 'Torneio de Setembro/2026' },
      calculadoEm: new Date('2026-10-15T13:05:00.000Z'),
      time: { nome: 'Corvos', posicao: 2, premioCentavos: 300_000, baseUsada: 'minutos', baseTime: 865 },
      comoFoiCalculado: {
        premioTotalCentavos: 1_000_000,
        percentualDaPosicao: 30,
        criterio: 'desempate por kills do time',
        empate: null,
        modoDivisao: 'minutos',
      },
      jogadores: [
        { nick: 'Corvinho', base: 173, baseUsada: 'minutos', centesimosDePercentual: 2000, premioCentavos: 60_000, recebeuCentavo: false, explicacao: null },
        { nick: 'M4theus', base: 173, baseUsada: 'minutos', centesimosDePercentual: 2000, premioCentavos: 60_000, recebeuCentavo: false, explicacao: null },
        { nick: 'Nina.exe', base: 173, baseUsada: 'minutos', centesimosDePercentual: 2000, premioCentavos: 60_000, recebeuCentavo: false, explicacao: null },
        { nick: 'Zeca', base: 173, baseUsada: 'minutos', centesimosDePercentual: 2000, premioCentavos: 60_000, recebeuCentavo: false, explicacao: null },
        { nick: 'Bia.gg', base: 154, baseUsada: 'minutos', centesimosDePercentual: 1780, premioCentavos: 53_410, recebeuCentavo: false, explicacao: null },
        { nick: 'Tuca', base: 19, baseUsada: 'minutos', centesimosDePercentual: 220, premioCentavos: 6_590, recebeuCentavo: true, explicacao: null },
      ],
      totalCentavos: 300_000,
      codigoPublico: CODIGO_PUBLICO,
    });
  });

  it('nenhum nick nem nome de outro time', () => {
    const texto = JSON.stringify(montarPaginaDoTime('Setembro', SETEMBRO, 'Corvos', CODIGO_PUBLICO));
    for (const outro of ['Lobos', 'Falcões', 'Tubarões', 'Panteras', 'Serpentes', 'xXSniperXx', 'Falk', 'Dudu.pro']) {
      expect(texto).not.toContain(outro);
    }
  });

  it('Falcões: o empate dividido, com as posições somadas e quantos times dividiram, sem dizer quais', () => {
    const pagina = montarPaginaDoTime('Setembro', SETEMBRO, 'Falcões', CODIGO_PUBLICO)!;
    expect(pagina.time).toMatchObject({ nome: 'Falcões', posicao: 3, premioCentavos: 100_000, baseTime: 900 });
    expect(pagina.comoFoiCalculado).toEqual({
      premioTotalCentavos: 1_000_000,
      percentualDaPosicao: 20,
      criterio: 'divisão igual (empate em vitórias e kills)',
      empate: { posicoes: [3, 4], percentuais: [20, 0], quantidadeDeTimes: 2 },
      modoDivisao: 'minutos',
    });
    expect(pagina.jogadores.map((j) => j.nick)).toEqual(['Dudu.pro', 'Falk', 'Kiwi', 'Marreta', 'Sol']);
    expect(pagina.totalCentavos).toBe(100_000);
    expect(JSON.stringify(pagina)).not.toContain('Tubarões');
  });

  it('Lobos, sem empate: critério nulo e o percentual do 1º', () => {
    const pagina = montarPaginaDoTime('Setembro', SETEMBRO, 'Lobos', CODIGO_PUBLICO)!;
    expect(pagina.comoFoiCalculado).toMatchObject({ percentualDaPosicao: 50, criterio: null, empate: null });
  });

  it('time sem prêmio ou que não existe: null (não tem página de time)', () => {
    expect(montarPaginaDoTime('Setembro', SETEMBRO, 'Panteras', CODIGO_PUBLICO)).toBeNull();
    expect(montarPaginaDoTime('Setembro', SETEMBRO, 'Ninguém', CODIGO_PUBLICO)).toBeNull();
  });
});

describe('centesimosDePercentual: só inteiros, arredondado para o mais próximo', () => {
  it('19 de 865 = 2,20%; 173 de 865 = 20,00%; 1 de 3 = 33,33%; 2 de 3 = 66,67%', () => {
    expect(centesimosDePercentual(19, 865)).toBe(220);
    expect(centesimosDePercentual(173, 865)).toBe(2000);
    expect(centesimosDePercentual(1, 3)).toBe(3333);
    expect(centesimosDePercentual(2, 3)).toBe(6667);
    expect(centesimosDePercentual(0, 0)).toBe(0);
  });
});
