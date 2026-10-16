import { describe, expect, it } from 'vitest';
import { contaDoJogador, enderecoDoLink, filtrarPorNick, passosDoCalculo } from '../src/dominio/link-do-time';
import type { JogadorDaPaginaDoTime, PaginaDoTime } from '../src/servicos/api';
import { comEspacosComuns } from './ajudantes/espacos';

const jogador = (nick: string, base: number, centesimos: number, premioCentavos: number, extra: Partial<JogadorDaPaginaDoTime> = {}): JogadorDaPaginaDoTime => ({
  nick, base, baseUsada: 'minutos', centesimosDePercentual: centesimos, premioCentavos, recebeuCentavo: false, explicacao: null, ...extra,
});

const CORVOS: PaginaDoTime = {
  torneio: { nome: 'Torneio de Setembro/2026' },
  calculadoEm: '2026-10-15T13:05:00.000Z',
  time: { nome: 'Corvos', posicao: 2, premioCentavos: 300_000, baseUsada: 'minutos', baseTime: 865 },
  comoFoiCalculado: { premioTotalCentavos: 1_000_000, percentualDaPosicao: 30, criterio: 'desempate por kills do time', empate: null, modoDivisao: 'minutos' },
  jogadores: [
    jogador('Corvinho', 173, 2000, 60_000), jogador('M4theus', 173, 2000, 60_000), jogador('Nina.exe', 173, 2000, 60_000),
    jogador('Zeca', 173, 2000, 60_000), jogador('Bia.gg', 154, 1780, 53_410), jogador('Tuca', 19, 220, 6_590, { recebeuCentavo: true }),
  ],
  totalCentavos: 300_000,
  codigoPublico: 'P'.repeat(32),
};

const ARREDONDAMENTO = 'Os valores são arredondados para o centavo. O centavo que sobra vai para quem estava mais perto de recebê-lo.';

describe('passosDoCalculo: "Como o valor foi calculado", sem citar outros times', () => {
  it('Corvos: o percentual da posição com o valor, o desempate por kills, os minutos e o arredondamento', () => {
    expect(comEspacosComuns(passosDoCalculo(CORVOS))).toEqual([
      'O prêmio do torneio é R$ 10.000,00. O 2º lugar leva 30%: R$ 3.000,00.',
      'Houve empate em vitórias; o desempate foi pelas kills do time, e Corvos ficou em 2º.',
      'Dentro do time, o valor é dividido pelos minutos que cada um jogou, conforme o registro oficial de cada partida.',
      ARREDONDAMENTO,
    ]);
  });

  it('Falcões: o empate dividido, com as posições somadas e quantos times dividiram, sem dizer quais', () => {
    const falcoes: PaginaDoTime = {
      ...CORVOS,
      time: { nome: 'Falcões', posicao: 3, premioCentavos: 100_000, baseUsada: 'minutos', baseTime: 900 },
      comoFoiCalculado: {
        premioTotalCentavos: 1_000_000, percentualDaPosicao: 20, criterio: 'divisão igual (empate em vitórias e kills)',
        empate: { posicoes: [3, 4], percentuais: [20, 0], quantidadeDeTimes: 2 }, modoDivisao: 'minutos',
      },
    };
    expect(comEspacosComuns(passosDoCalculo(falcoes))).toEqual([
      'O prêmio do torneio é R$ 10.000,00. O 3º lugar leva 20%.',
      'Falcões empatou em vitórias e em kills com mais 1 time: os prêmios do 3º e do 4º lugar (20% e 0%) foram somados e divididos igualmente entre os 2 times. O prêmio do time ficou em R$ 1.000,00.',
      'Dentro do time, o valor é dividido pelos minutos que cada um jogou, conforme o registro oficial de cada partida.',
      ARREDONDAMENTO,
    ]);
  });

  it('sem empate: o passo do critério não aparece', () => {
    const lobos: PaginaDoTime = {
      ...CORVOS,
      time: { ...CORVOS.time, nome: 'Lobos', posicao: 1, premioCentavos: 500_000 },
      comoFoiCalculado: { ...CORVOS.comoFoiCalculado, percentualDaPosicao: 50, criterio: null },
    };
    expect(comEspacosComuns(passosDoCalculo(lobos))).toEqual([
      'O prêmio do torneio é R$ 10.000,00. O 1º lugar leva 50%: R$ 5.000,00.',
      'Dentro do time, o valor é dividido pelos minutos que cada um jogou, conforme o registro oficial de cada partida.',
      ARREDONDAMENTO,
    ]);
  });

  it('o valor do percentual com centavo pelo maior resto (D20): R$ 1.234,57 × 50% = R$ 617,29', () => {
    const pagina: PaginaDoTime = {
      ...CORVOS,
      time: { ...CORVOS.time, posicao: 1, premioCentavos: 61_729 },
      comoFoiCalculado: { ...CORVOS.comoFoiCalculado, premioTotalCentavos: 123_457, percentualDaPosicao: 50, criterio: null },
    };
    expect(comEspacosComuns(passosDoCalculo(pagina)[0])).toBe('O prêmio do torneio é R$ 1.234,57. O 1º lugar leva 50%: R$ 617,29.');
  });

  it('menos times do que posições premiadas (D24): o prêmio do time não é só o percentual, e o passo explica', () => {
    const pagina: PaginaDoTime = {
      ...CORVOS,
      time: { ...CORVOS.time, posicao: 1, premioCentavos: 600_000 },
      comoFoiCalculado: { ...CORVOS.comoFoiCalculado, percentualDaPosicao: 50, criterio: null },
    };
    expect(comEspacosComuns(passosDoCalculo(pagina)[0])).toBe(
      'O prêmio do torneio é R$ 10.000,00. O 1º lugar leva 50%. O torneio teve menos times do que posições premiadas: o valor das posições sem time foi dividido igualmente entre todos os times, e o prêmio do time ficou em R$ 6.000,00.',
    );
  });

  it('modo kills: pelas kills; e o time sem kills, dividido pelos minutos (D21)', () => {
    const kills: PaginaDoTime = { ...CORVOS, time: { ...CORVOS.time, baseUsada: 'kills', baseTime: 120 }, comoFoiCalculado: { ...CORVOS.comoFoiCalculado, modoDivisao: 'kills' } };
    expect(passosDoCalculo(kills)[2]).toBe('Dentro do time, o valor é dividido pelas kills de cada um, conforme o registro oficial de cada partida.');

    const semKills: PaginaDoTime = { ...CORVOS, comoFoiCalculado: { ...CORVOS.comoFoiCalculado, modoDivisao: 'kills' } };
    expect(passosDoCalculo(semKills)[2]).toBe('O torneio divide pelas kills, mas ninguém do time fez kills: o prêmio do time foi dividido pelos minutos que cada um jogou.');
  });
});

describe('contaDoJogador: a conta de cada cartão', () => {
  it('"173 de 865 minutos (20,00%) × R$ 3.000,00" e, no modo kills, "kills"', () => {
    expect(comEspacosComuns(contaDoJogador(CORVOS.jogadores[0], CORVOS.time))).toBe('173 de 865 minutos (20,00%) × R$ 3.000,00');
    expect(comEspacosComuns(contaDoJogador(CORVOS.jogadores[5], CORVOS.time))).toBe('19 de 865 minutos (2,20%) × R$ 3.000,00');
    expect(comEspacosComuns(contaDoJogador(jogador('Lua_', 88, 2493, 124_646, { baseUsada: 'kills' }), { ...CORVOS.time, premioCentavos: 500_000, baseTime: 353 })))
      .toBe('88 de 353 kills (24,93%) × R$ 5.000,00');
  });
});

describe('filtrarPorNick: "Procurar meu nick"', () => {
  it('parcial, sem diferenciar maiúsculas nem acentos; vazio mostra todos', () => {
    expect(filtrarPorNick(CORVOS.jogadores, 'TU').map((j) => j.nick)).toEqual(['Tuca']);
    expect(filtrarPorNick(CORVOS.jogadores, '  nina ').map((j) => j.nick)).toEqual(['Nina.exe']);
    expect(filtrarPorNick([jogador('Víbora', 1, 1, 1)], 'vibora').map((j) => j.nick)).toEqual(['Víbora']);
    expect(filtrarPorNick(CORVOS.jogadores, '')).toHaveLength(6);
    expect(filtrarPorNick(CORVOS.jogadores, 'zzz')).toEqual([]);
  });
});

describe('enderecoDoLink: o endereço completo para a Maria copiar', () => {
  it('com a origem da própria tela', () => {
    expect(enderecoDoLink('http://localhost:5173', 'publico', 'abc')).toBe('http://localhost:5173/publico/abc');
    expect(enderecoDoLink('https://premios.exemplo.com', 'time', 'x_Y-z')).toBe('https://premios.exemplo.com/time/x_Y-z');
  });
});
