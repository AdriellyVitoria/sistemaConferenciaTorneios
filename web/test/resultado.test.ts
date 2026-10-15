import { describe, expect, it } from 'vitest';
import {
  buscarNoResultado,
  descreverPosicoesPremiadas,
  explicarEmpates,
  observacaoDoJogador,
  percentualDoTime,
  rotuloDoCriterio,
} from '../src/dominio/resultado';
import type { JogadorDoResultado, TimeDoResultado } from '../src/servicos/api';

const time = (posicao: number, nome: string, vitorias: number, killsTime: number, premioCentavos: number, criterio: string | null = null): TimeDoResultado => ({
  posicao, time: nome, vitorias, killsTime, premioCentavos, criterio, recebeuCentavo: false,
});

// a classificação de setembro, como a API devolve
const SETEMBRO: TimeDoResultado[] = [
  time(1, 'Lobos', 5, 353, 500_000),
  time(2, 'Corvos', 3, 368, 300_000, 'desempate por kills do time'),
  time(3, 'Falcões', 3, 310, 100_000, 'divisão igual (empate em vitórias e kills)'),
  time(3, 'Tubarões', 3, 310, 100_000, 'divisão igual (empate em vitórias e kills)'),
  time(5, 'Panteras', 1, 269, 0),
  time(6, 'Serpentes', 0, 249, 0),
];

describe('explicarEmpates: a frase sai dos dados gravados, nada fixo no código', () => {
  it('setembro: o empate triplo, o desempate por kills e a divisão do 3º lugar', () => {
    expect(explicarEmpates(SETEMBRO, [50, 30, 20])).toEqual([
      'Corvos, Falcões e Tubarões terminaram com 3 vitórias. Corvos fez mais kills (368) e ficou em 2º. Falcões e Tubarões empataram também em kills (310) e dividiram o prêmio do 3º lugar: R$ 2.000,00, metade para cada time.',
    ]);
  });

  it('cenário 04: o empate em kills dividiu o prêmio de duas posições', () => {
    const times = [
      time(1, 'Dragões', 5, 405, 500_000),
      time(2, 'Fênix', 3, 398, 250_000, 'divisão igual (empate em vitórias e kills)'),
      time(2, 'Leões', 3, 398, 250_000, 'divisão igual (empate em vitórias e kills)'),
      time(4, 'Lobos-Guará', 2, 300, 0, 'empate em vitórias e kills'),
      time(4, 'Ursos', 2, 300, 0, 'empate em vitórias e kills'),
      time(6, 'Águias', 0, 200, 0),
    ];
    expect(explicarEmpates(times, [50, 30, 20])).toEqual([
      'Fênix e Leões terminaram com 3 vitórias e empataram também em kills (398): dividiram os prêmios do 2º e do 3º lugar, R$ 5.000,00, metade para cada time.',
      'Lobos-Guará e Ursos terminaram com 2 vitórias e empataram também em kills (300): ficaram em 4º. Este torneio premia só 3 posições.',
    ]);
  });

  it('setembro em 50/50: o empate do 3º cai fora das posições premiadas', () => {
    const times = [
      time(1, 'Lobos', 5, 353, 500_000),
      time(2, 'Corvos', 3, 368, 500_000, 'desempate por kills do time'),
      time(3, 'Falcões', 3, 310, 0, 'empate em vitórias e kills'),
      time(3, 'Tubarões', 3, 310, 0, 'empate em vitórias e kills'),
      time(5, 'Panteras', 1, 269, 0),
      time(6, 'Serpentes', 0, 249, 0),
    ];
    expect(explicarEmpates(times, [50, 50])).toEqual([
      'Corvos, Falcões e Tubarões terminaram com 3 vitórias. Corvos fez mais kills (368) e ficou em 2º. Falcões e Tubarões empataram também em kills (310) e ficaram em 3º. Este torneio premia só 2 posições.',
    ]);
  });

  it('premia uma posição só: "só 1 posição", no singular', () => {
    const times = [time(1, 'A', 3, 90, 1_000_000), time(2, 'B', 1, 50, 0, 'empate em vitórias e kills'), time(2, 'C', 1, 50, 0, 'empate em vitórias e kills')];
    expect(explicarEmpates(times, [100])).toEqual([
      'B e C terminaram com 1 vitória e empataram também em kills (50): ficaram em 2º. Este torneio premia só 1 posição.',
    ]);
  });

  it('dois times com as mesmas vitórias, desempatados por kills', () => {
    expect(explicarEmpates([time(1, 'A', 4, 300, 600_000), time(2, 'B', 4, 250, 400_000, 'desempate por kills do time')], [60, 40])).toEqual([
      'A e B terminaram com 4 vitórias. A fez mais kills (300) e ficou em 1º. B ficou em 2º (250 kills).',
    ]);
  });

  it('três times empatados em tudo: um terço para cada', () => {
    const times = ['A', 'B', 'C'].map((n) => time(1, n, 2, 100, 333_334, 'divisão igual (empate em vitórias e kills)'));
    expect(explicarEmpates(times, [50, 30, 20])[0]).toContain('dividiram os prêmios do 1º, do 2º e do 3º lugar, R$ 10.000,02, um terço para cada time.');
  });

  it('sem empate em vitórias: nenhuma frase', () => {
    expect(explicarEmpates([time(1, 'A', 3, 10, 700_000), time(2, 'B', 2, 10, 300_000)], [70, 30])).toEqual([]);
  });
});

describe('descreverPosicoesPremiadas: quantas posições o torneio premia', () => {
  it('setembro, 50/50 e uma posição só', () => {
    expect(descreverPosicoesPremiadas([50, 30, 20])).toBe('Premia 3 posições: 1º 50% · 2º 30% · 3º 20%');
    expect(descreverPosicoesPremiadas([50, 50])).toBe('Premia 2 posições: 1º 50% · 2º 50%');
    expect(descreverPosicoesPremiadas([100])).toBe('Premia 1 posição: 1º 100%');
  });

  it('posição com 0% não é premiada: não entra na conta', () => {
    expect(descreverPosicoesPremiadas([50, 50, 0])).toBe('Premia 2 posições: 1º 50% · 2º 50%');
  });
});

describe('rotuloDoCriterio', () => {
  it('o critério gravado vira um selo curto', () => {
    expect(rotuloDoCriterio('desempate por kills do time')).toEqual({ texto: 'Desempate por kills', tom: 'info' });
    expect(rotuloDoCriterio('divisão igual (empate em vitórias e kills)')).toEqual({ texto: 'Empate total · prêmio dividido', tom: 'alerta' });
    expect(rotuloDoCriterio('empate em vitórias e kills')).toEqual({ texto: 'Empate total', tom: 'neutro' });
    expect(rotuloDoCriterio(null)).toBeNull();
  });
});

const jogador = (time: string, posicao: number, nick: string, premioCentavos: number, extra: Partial<JogadorDoResultado> = {}): JogadorDoResultado => ({
  time, posicao, nick, minutos: 173, kills: 20, base: 173, baseTime: 865, baseUsada: 'minutos', premioCentavos, recebeuCentavo: false, explicacao: null, ...extra,
});

describe('percentualDoTime e observacaoDoJogador', () => {
  it('% do time com duas casas, sem float no arredondamento', () => {
    expect(percentualDoTime(19, 865)).toBe('2,20%');
    expect(percentualDoTime(173, 865)).toBe('20,00%');
    expect(percentualDoTime(1, 3)).toBe('33,33%');
    expect(percentualDoTime(0, 0)).toBe('—');
  });

  it('observação: o centavo de arredondamento e a explicação gravada', () => {
    expect(observacaoDoJogador(jogador('Corvos', 2, 'Tuca', 6_590, { recebeuCentavo: true }))).toBe('+R$ 0,01 de arredondamento');
    expect(observacaoDoJogador(jogador('Lobos', 1, 'Lua_', 100_000, { explicacao: 'Ninguém do time fez kills; o prêmio foi dividido pelos minutos jogados.' })))
      .toBe('Ninguém do time fez kills; o prêmio foi dividido pelos minutos jogados.');
    expect(observacaoDoJogador(jogador('Lobos', 1, 'Lua_', 100_000))).toBe('');
  });
});

describe('buscarNoResultado: o filtro por nick', () => {
  const JOGADORES = [
    jogador('Lobos', 1, 'xXSniperXx', 100_000),
    jogador('Corvos', 2, 'Tuca', 6_590),
    jogador('Tubarões', 3, 'Ju.lia', 20_000),
    jogador('Panteras', 5, 'Pantera_X', 0),
    jogador('Serpentes', 6, 'Víbora', 0),
  ];

  it('sem busca: os premiados', () => {
    expect(buscarNoResultado(JOGADORES, '').premiados.map((j) => j.nick)).toEqual(['xXSniperXx', 'Tuca', 'Ju.lia']);
  });

  it('parcial e sem diferenciar maiúsculas: "sniper" acha xXSniperXx', () => {
    expect(buscarNoResultado(JOGADORES, 'SNIPER').premiados.map((j) => j.nick)).toEqual(['xXSniperXx']);
  });

  it('sem diferenciar acentos: "vibora" acha Víbora, de time sem prêmio, com a frase', () => {
    const r = buscarNoResultado(JOGADORES, 'vibora');
    expect(r.premiados).toEqual([]);
    expect(r.semPremio).toEqual(['Víbora jogou pelo time Serpentes, que ficou em 6º, sem prêmio.']);
    expect(r.nenhum).toBe(false);
  });

  it('nick inexistente: nenhum', () => {
    expect(buscarNoResultado(JOGADORES, 'zzz')).toEqual({ premiados: [], semPremio: [], nenhum: true });
  });
});
