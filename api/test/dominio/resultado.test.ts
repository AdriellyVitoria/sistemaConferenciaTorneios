import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compararComSite, type PartidaSite } from '../../src/dominio/comparacao';
import { lerPlanilha } from '../../src/dominio/planilha';
import { montarResultado } from '../../src/dominio/resultado';

// Arquivos só lidos.
const RAIZ = path.resolve(__dirname, '../../..');
const SITE_SETEMBRO: Record<string, PartidaSite> = JSON.parse(readFileSync(path.join(__dirname, '../fixtures/site-setembro.json'), 'utf8'));

/** Os dados oficiais de setembro, como a comparação entrega ao cálculo (D3). */
function partidasDeSetembro(): PartidaSite[] {
  const leitura = lerPlanilha(readFileSync(path.join(RAIZ, 'torneio-setembro.csv')));
  if (!leitura.ok) throw new Error('planilha inválida');
  const respostas = Object.fromEntries(Object.entries(SITE_SETEMBRO).map(([id, partida]) => [id, { status: 'encontrada' as const, partida }]));
  return compararComSite(leitura.linhas, respostas).partidasOficiais;
}

const CONFIG = { premioCentavos: 1_000_000, percentuais: [50, 30, 20] };
const jogador = (r: ReturnType<typeof montarResultado>, time: string, nick: string) => r.jogadores.find((j) => j.time === time && j.nick === nick);

describe('montarResultado: o resultado completo a partir dos dados do site', () => {
  const r = montarResultado({ partidas: partidasDeSetembro(), ...CONFIG, modoDivisao: 'minutos' });

  it('setembro: classificação com o empate do 3º lugar (D2) e o prêmio de cada time (D20)', () => {
    expect(r.times.map((t) => [t.posicao, t.time, t.vitorias, t.killsTime, t.premioCentavos, t.criterio])).toEqual([
      [1, 'Lobos', 5, 353, 500_000, null],
      [2, 'Corvos', 3, 368, 300_000, 'desempate por kills do time'],
      [3, 'Falcões', 3, 310, 100_000, 'divisão igual (empate em vitórias e kills)'],
      [3, 'Tubarões', 3, 310, 100_000, 'divisão igual (empate em vitórias e kills)'],
      [5, 'Panteras', 1, 269, 0, null],
      [6, 'Serpentes', 0, 249, 0, null],
    ]);
  });

  it('setembro por minutos: Lobos R$ 1.000 cada; Corvos com Tuca R$ 65,90 e o centavo dele (D8, D9); 3º lugar R$ 200 cada', () => {
    for (const nick of ['Dona.Tank', 'Lua_', 'Pipoca', 'R4mbo', 'xXSniperXx']) expect(jogador(r, 'Lobos', nick)?.premioCentavos).toBe(100_000);
    expect(jogador(r, 'Corvos', 'Tuca')).toMatchObject({ minutos: 19, premioCentavos: 6_590, recebeuCentavo: true });
    expect(jogador(r, 'Corvos', 'Bia.gg')).toMatchObject({ minutos: 154, premioCentavos: 53_410, recebeuCentavo: false });
    for (const time of ['Falcões', 'Tubarões']) {
      const doTime = r.jogadores.filter((j) => j.time === time);
      expect(doTime).toHaveLength(5);
      expect(doTime.every((j) => j.premioCentavos === 20_000)).toBe(true);
    }
  });

  it('cada jogador traz os minutos e as kills somados por aquele time, e o nick como no site (D7)', () => {
    expect(jogador(r, 'Lobos', 'xXSniperXx')).toMatchObject({ minutos: 211, kills: 89, base: 211, baseTime: 1055, baseUsada: 'minutos' });
    expect(r.jogadores.some((j) => j.nick === 'xxsniperxx')).toBe(false);
  });

  it('jogadores dos times sem prêmio também entram, com R$ 0 e os números deles (6b)', () => {
    // Pantera_X, duplicado na planilha, conta uma vez: os dados são os do site (D6)
    const panteraX = r.jogadores.filter((j) => j.nick === 'Pantera_X');
    expect(panteraX).toHaveLength(1);
    expect(panteraX[0]).toMatchObject({ time: 'Panteras', premioCentavos: 0, recebeuCentavo: false, baseUsada: 'minutos' });
    expect(panteraX[0].minutos).toBeGreaterThan(0);
    expect(r.jogadores.filter((j) => j.time === 'Serpentes')).toHaveLength(5);
    expect(r.jogadores.filter((j) => j.time === 'Serpentes').every((j) => j.premioCentavos === 0)).toBe(true);
    // todo jogador do site aparece uma vez por time em que jogou
    expect(r.jogadores).toHaveLength(31);
  });

  it('a soma de todos os jogadores é o prêmio total, e a de cada time é o valor do time', () => {
    expect(r.jogadores.reduce((s, j) => s + j.premioCentavos, 0)).toBe(1_000_000);
    for (const t of r.times) {
      expect(r.jogadores.filter((j) => j.time === t.time).reduce((s, j) => s + j.premioCentavos, 0)).toBe(t.premioCentavos);
    }
  });

  it('setembro por kills (D1): os valores dos Lobos do contexto.md, seção 8', () => {
    const porKills = montarResultado({ partidas: partidasDeSetembro(), ...CONFIG, modoDivisao: 'kills' });
    expect(['xXSniperXx', 'Lua_', 'Pipoca', 'R4mbo', 'Dona.Tank'].map((nick) => jogador(porKills, 'Lobos', nick)?.premioCentavos)).toEqual([
      126_062, 124_646, 94_901, 83_569, 70_822,
    ]);
    expect(jogador(porKills, 'Lobos', 'Lua_')).toMatchObject({ kills: 88, base: 88, baseUsada: 'kills' });
  });

  it('modo kills (D21): jogador com 0 kill recebe R$ 0; time premiado sem nenhuma kill divide pelos minutos', () => {
    const partidas = structuredClone(partidasDeSetembro());
    for (const p of partidas) {
      for (const j of p.jogadores) {
        if (j.nick === 'Tuca') j.kills = 0;
        if (j.time === 'Lobos') j.kills = 0;
      }
    }
    const porKills = montarResultado({ partidas, ...CONFIG, modoDivisao: 'kills' });
    expect(jogador(porKills, 'Corvos', 'Tuca')).toMatchObject({ kills: 0, premioCentavos: 0 });
    const lobos = porKills.jogadores.filter((j) => j.time === 'Lobos');
    expect(lobos.every((j) => j.baseUsada === 'minutos' && j.premioCentavos === 100_000)).toBe(true);
    expect(lobos[0].explicacao).toBe('Ninguém do time fez kills; o prêmio foi dividido pelos minutos jogados.');
  });
});
