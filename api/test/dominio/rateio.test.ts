import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classificar } from '../../src/dominio/classificacao';
import type { JogadorSite, PartidaSite } from '../../src/dominio/comparacao';
import { lerPlanilha } from '../../src/dominio/planilha';
import { premiarTimes, type PremioTime } from '../../src/dominio/premio';
import { ratearEntreJogadores, type ModoDivisao } from '../../src/dominio/rateio';

const RAIZ = path.resolve(__dirname, '../../..');
const SITE_OFICIAL: Record<string, PartidaSite> = JSON.parse(
  readFileSync(path.join(RAIZ, 'testes/site-oficial.json'), 'utf8'),
);
const SITE_SETEMBRO: Record<string, PartidaSite> = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/site-setembro.json'), 'utf8'),
);
const PREMIO = 1_000_000;
const PERCENTUAIS = [50, 30, 20];

function partidasDoCenario(planilha: string, site: Record<string, PartidaSite>): PartidaSite[] {
  const resultado = lerPlanilha(readFileSync(path.join(RAIZ, planilha)));
  if (!resultado.ok) throw new Error(`planilha inválida: ${planilha}`);
  return [...new Set(resultado.linhas.map((l) => l.idPartida))].map((id) => site[id]);
}

function calcular(planilha: string, site: Record<string, PartidaSite>, modo: ModoDivisao, percentuais = PERCENTUAIS) {
  const partidas = partidasDoCenario(planilha, site);
  const premiosTimes = premiarTimes(classificar(partidas), PREMIO, percentuais);
  return ratearEntreJogadores(premiosTimes, partidas, modo);
}

function esperado(nome: string) {
  const texto = readFileSync(path.join(RAIZ, 'testes/esperado', `${nome}-jogadores.csv`), 'utf8');
  return texto.split(/\r?\n/).filter(Boolean).slice(1).map((linha) => {
    const [time, nick, minutos, minutosTime, premio] = linha.split(';');
    const [reais, centavos] = premio.split(',');
    return { time, nick, base: Number(minutos), baseTime: Number(minutosTime), premioCentavos: Number(reais) * 100 + Number(centavos) };
  });
}

const porChave = <T extends { time: string; nick: string }>(lista: T[]) =>
  [...lista].sort((a, b) => `${a.time}|${a.nick}`.localeCompare(`${b.time}|${b.nick}`));

describe('ratearEntreJogadores — esperados de testes/esperado/ (modo minutos)', () => {
  const cenarios: [string, string, Record<string, PartidaSite>][] = [
    ['01-limpa', 'testes/planilhas/01-limpa.csv', SITE_OFICIAL],
    ['04-empate-em-kills', 'testes/planilhas/04-empate-em-kills.csv', SITE_OFICIAL],
    ['05-oito-times', 'testes/planilhas/05-oito-times.csv', SITE_OFICIAL],
    ['torneio-outubro', 'testes/planilhas/torneio-outubro.csv', SITE_OFICIAL],
    ['torneio-setembro', 'torneio-setembro.csv', SITE_SETEMBRO],
  ];

  for (const [nome, planilha, site] of cenarios) {
    it(`${nome}: prêmio, minutos e minutos do time de cada jogador iguais ao arquivo`, () => {
      const jogadores = calcular(planilha, site, 'minutos');
      const obtido = jogadores.map((j) => ({ time: j.time, nick: j.nick, base: j.base, baseTime: j.baseTime, premioCentavos: j.premioCentavos }));
      expect(porChave(obtido)).toEqual(porChave(esperado(nome)));
      expect(jogadores.reduce((soma, j) => soma + j.premioCentavos, 0)).toBe(PREMIO);
    });
  }

  it('setembro: Tuca recebe R$ 65,90 com o centavo de arredondamento; os de 173 minutos, R$ 600,00 sem centavo', () => {
    const corvos = calcular('torneio-setembro.csv', SITE_SETEMBRO, 'minutos').filter((j) => j.time === 'Corvos');
    expect(corvos.find((j) => j.nick === 'Tuca')).toMatchObject({
      base: 19, baseTime: 865, premioCentavos: 6_590, recebeuCentavo: true, baseUsada: 'minutos',
    });
    for (const nick of ['Corvinho', 'M4theus', 'Nina.exe', 'Zeca']) {
      expect(corvos.find((j) => j.nick === nick)).toMatchObject({ premioCentavos: 60_000, recebeuCentavo: false });
    }
    expect(corvos.filter((j) => j.recebeuCentavo).map((j) => j.nick)).toEqual(['Tuca']);
  });

  it('times sem prêmio não geram linhas de jogador', () => {
    const times = new Set(calcular('torneio-setembro.csv', SITE_SETEMBRO, 'minutos').map((j) => j.time));
    expect([...times].sort()).toEqual(['Corvos', 'Falcões', 'Lobos', 'Tubarões']);
  });
});

describe('ratearEntreJogadores — modo kills', () => {
  it('Lobos de setembro por kills: R$ 1.260,62, 1.246,46, 949,01, 835,69 e 708,22', () => {
    const lobos = calcular('torneio-setembro.csv', SITE_SETEMBRO, 'kills').filter((j) => j.time === 'Lobos');
    const valor = (nick: string) => lobos.find((j) => j.nick === nick)?.premioCentavos;
    expect([valor('xXSniperXx'), valor('Lua_'), valor('Pipoca'), valor('R4mbo'), valor('Dona.Tank')])
      .toEqual([126_062, 124_646, 94_901, 83_569, 70_822]);
    expect(lobos.find((j) => j.nick === 'Lua_')).toMatchObject({ base: 88, baseTime: 353, baseUsada: 'kills', recebeuCentavo: true });
  });

  it('jogador com 0 kills recebe R$ 0 (D21)', () => {
    const partidas = [partida('#1', 'Lobos', 'Serpentes', 'Lobos', [j('Lua_', 'Lobos', 40, 10), j('Tank', 'Lobos', 40, 0), j('Naja', 'Serpentes', 40, 3)])];
    const jogadores = ratearEntreJogadores([premioDe('Lobos', 1, 100_000), premioDe('Serpentes', 2, 0)], partidas, 'kills');
    expect(jogadores.map((x) => [x.nick, x.premioCentavos])).toEqual([['Lua_', 100_000], ['Tank', 0]]);
  });

  it('time premiado sem nenhuma kill: divide pelos minutos e o extrato explica (D21)', () => {
    const partidas = [
      partida('#1', 'Corvos', 'Panteras', 'Corvos', [j('Zeca', 'Corvos', 30, 0), j('Tuca', 'Corvos', 10, 0), j('Mel', 'Panteras', 40, 5)]),
    ];
    const jogadores = ratearEntreJogadores([premioDe('Corvos', 1, 100_000), premioDe('Panteras', 2, 0)], partidas, 'kills');
    expect(jogadores).toEqual([
      expect.objectContaining({ nick: 'Tuca', base: 10, baseTime: 40, baseUsada: 'minutos', premioCentavos: 25_000 }),
      expect.objectContaining({ nick: 'Zeca', base: 30, baseTime: 40, baseUsada: 'minutos', premioCentavos: 75_000 }),
    ]);
    expect(jogadores[0].explicacao).toBe('Ninguém do time fez kills; o prêmio foi dividido pelos minutos jogados.');
  });

  it('time premiado sem kills e sem minutos: erro claro (não acontece com dados do site)', () => {
    const partidas = [partida('#1', 'Corvos', 'Panteras', 'Panteras', [j('Zeca', 'Corvos', 0, 0), j('Mel', 'Panteras', 40, 5)])];
    expect(() => ratearEntreJogadores([premioDe('Corvos', 1, 100)], partidas, 'kills')).toThrow('Corvos');
  });
});

describe('ratearEntreJogadores — jogador em dois times (D13)', () => {
  it('cenário 07 com 50/30/20: Garra recebe só pelos Leões, com os minutos só pelos Leões', () => {
    const partidas = partidasDoCenario('testes/planilhas/07-jogador-em-dois-times.csv', SITE_OFICIAL);
    const minutosPor = (time: string) =>
      partidas.flatMap((p) => p.jogadores).filter((x) => x.nick === 'Garra' && x.time === time).reduce((s, x) => s + x.minutos, 0);
    const garra = calcular('testes/planilhas/07-jogador-em-dois-times.csv', SITE_OFICIAL, 'minutos').filter((x) => x.nick === 'Garra');

    expect(minutosPor('Ursos')).toBeGreaterThan(0);
    expect(garra.map((x) => [x.time, x.base])).toEqual([['Leões', minutosPor('Leões')]]);
  });

  it('caso pequeno com os dois times premiados: Garra recebe separado em cada um', () => {
    const partidas = [
      partida('#1', 'Leões', 'Ursos', 'Leões', [j('Garra', 'Leões', 30, 5), j('Juba', 'Leões', 30, 5), j('Panda', 'Ursos', 40, 2)]),
      partida('#2', 'Ursos', 'Águias', 'Ursos', [j('Garra', 'Ursos', 20, 1), j('Panda', 'Ursos', 20, 3), j('Bico', 'Águias', 40, 0)]),
    ];
    const jogadores = ratearEntreJogadores(
      [premioDe('Leões', 1, 60_000), premioDe('Ursos', 2, 40_000), premioDe('Águias', 3, 0)],
      partidas,
      'minutos',
    );
    expect(jogadores.map((x) => [x.time, x.nick, x.base, x.baseTime, x.premioCentavos])).toEqual([
      ['Leões', 'Garra', 30, 60, 30_000],
      ['Leões', 'Juba', 30, 60, 30_000],
      ['Ursos', 'Garra', 20, 80, 10_000],
      ['Ursos', 'Panda', 60, 80, 30_000],
    ]);
  });
});

function j(nick: string, time: string, minutos: number, kills: number): JogadorSite {
  return { nick, time, minutos, kills };
}

function partida(id: string, a: string, b: string, vencedor: string, jogadores: JogadorSite[]): PartidaSite {
  return { id, data: '2026-09-05', times: [a, b], vencedor, jogadores };
}

function premioDe(time: string, posicao: number, premioCentavos: number): PremioTime {
  return { posicao, time, vitorias: 0, killsTime: 0, criterio: null, premioCentavos, recebeuCentavo: false };
}
