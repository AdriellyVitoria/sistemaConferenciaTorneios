import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classificar, type ClassificacaoTime } from '../../src/dominio/classificacao';
import type { PartidaSite } from '../../src/dominio/comparacao';
import { lerPlanilha } from '../../src/dominio/planilha';
import { erroDosPercentuais, premiarTimes } from '../../src/dominio/premio';

const RAIZ = path.resolve(__dirname, '../../..');
const SITE_OFICIAL: Record<string, PartidaSite> = JSON.parse(
  readFileSync(path.join(RAIZ, 'testes/site-oficial.json'), 'utf8'),
);
const SITE_SETEMBRO: Record<string, PartidaSite> = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/site-setembro.json'), 'utf8'),
);
const PREMIO = 1_000_000;
const PERCENTUAIS = [50, 30, 20];

function classificacaoDoCenario(planilha: string, site: Record<string, PartidaSite>): ClassificacaoTime[] {
  const resultado = lerPlanilha(readFileSync(path.join(RAIZ, planilha)));
  if (!resultado.ok) throw new Error(`planilha inválida: ${planilha}`);
  const ids = [...new Set(resultado.linhas.map((l) => l.idPartida))];
  return classificar(ids.map((id) => site[id]));
}

function esperado(nome: string) {
  const texto = readFileSync(path.join(RAIZ, 'testes/esperado', `${nome}-classificacao.csv`), 'utf8');
  return texto.split(/\r?\n/).filter(Boolean).slice(1).map((linha) => {
    const [posicao, time, , , premio, criterio] = linha.split(';');
    const [reais, centavos] = premio.split(',');
    return {
      posicao: Number(posicao),
      time,
      premioCentavos: Number(reais) * 100 + Number(centavos),
      criterio: criterio || null,
    };
  });
}

describe('premiarTimes — esperados de testes/esperado/', () => {
  const cenarios: [string, string, Record<string, PartidaSite>][] = [
    ['01-limpa', 'testes/planilhas/01-limpa.csv', SITE_OFICIAL],
    ['04-empate-em-kills', 'testes/planilhas/04-empate-em-kills.csv', SITE_OFICIAL],
    ['05-oito-times', 'testes/planilhas/05-oito-times.csv', SITE_OFICIAL],
    ['torneio-outubro', 'testes/planilhas/torneio-outubro.csv', SITE_OFICIAL],
    ['torneio-setembro', 'torneio-setembro.csv', SITE_SETEMBRO],
  ];

  for (const [nome, planilha, site] of cenarios) {
    it(`${nome}: prêmio e critério de cada time iguais ao arquivo`, () => {
      const premios = premiarTimes(classificacaoDoCenario(planilha, site), PREMIO, PERCENTUAIS);
      expect(premios.map((p) => ({ posicao: p.posicao, time: p.time, premioCentavos: p.premioCentavos, criterio: p.criterio })))
        .toEqual(esperado(nome));
      expect(premios.reduce((soma, p) => soma + p.premioCentavos, 0)).toBe(PREMIO);
    });
  }

  it('setembro: Falcões e Tubarões somam 3º e 4º (20% + 0%) e dividem igual', () => {
    const premios = premiarTimes(classificacaoDoCenario('torneio-setembro.csv', SITE_SETEMBRO), PREMIO, PERCENTUAIS);
    expect(premios.filter((p) => p.posicao === 3).map((p) => [p.time, p.premioCentavos, p.criterio])).toEqual([
      ['Falcões', 100_000, 'divisão igual (empate em vitórias e kills)'],
      ['Tubarões', 100_000, 'divisão igual (empate em vitórias e kills)'],
    ]);
  });
});

const time = (
  posicao: number, nome: string, criterio: ClassificacaoTime['criterio'] = null,
): ClassificacaoTime => ({ posicao, time: nome, vitorias: 0, killsTime: 0, criterio });

describe('premiarTimes — casos pequenos', () => {
  it('3 times empatados em 1º dividem 100%: o centavo que sobra vai pela ordem alfabética', () => {
    const premios = premiarTimes(
      [
        time(1, 'Tubarões', 'empate em vitórias e kills'),
        time(1, 'Corvos', 'empate em vitórias e kills'),
        time(1, 'Falcões', 'empate em vitórias e kills'),
        time(4, 'Serpentes'),
      ],
      PREMIO,
      PERCENTUAIS,
    );
    expect(premios.map((p) => [p.time, p.premioCentavos, p.recebeuCentavo, p.criterio])).toEqual([
      ['Tubarões', 333_333, false, 'divisão igual (empate em vitórias e kills)'],
      ['Corvos', 333_334, true, 'divisão igual (empate em vitórias e kills)'],
      ['Falcões', 333_333, false, 'divisão igual (empate em vitórias e kills)'],
      ['Serpentes', 0, false, null],
    ]);
  });

  it('2 times empatados fora do pódio: sem prêmio, o critério fica só "empate em vitórias e kills"', () => {
    const premios = premiarTimes(
      [
        time(1, 'Lobos'),
        time(2, 'Corvos'),
        time(3, 'Falcões'),
        time(4, 'Panteras', 'empate em vitórias e kills'),
        time(4, 'Serpentes', 'empate em vitórias e kills'),
      ],
      PREMIO,
      PERCENTUAIS,
    );
    expect(premios.map((p) => [p.posicao, p.time, p.premioCentavos, p.criterio])).toEqual([
      [1, 'Lobos', 500_000, null],
      [2, 'Corvos', 300_000, null],
      [3, 'Falcões', 200_000, null],
      [4, 'Panteras', 0, 'empate em vitórias e kills'],
      [4, 'Serpentes', 0, 'empate em vitórias e kills'],
    ]);
  });

  it('mantém o critério "desempate por kills do time" e os dados da classificação', () => {
    const [primeiro] = premiarTimes(
      [{ posicao: 1, time: 'Corvos', vitorias: 3, killsTime: 368, criterio: 'desempate por kills do time' }],
      PREMIO,
      [100],
    );
    expect(primeiro).toEqual({
      posicao: 1, time: 'Corvos', vitorias: 3, killsTime: 368,
      criterio: 'desempate por kills do time', premioCentavos: PREMIO, recebeuCentavo: false,
    });
  });

  it('posições além da lista de percentuais recebem 0%', () => {
    const premios = premiarTimes([time(1, 'A'), time(2, 'B'), time(3, 'C')], PREMIO, [60, 40]);
    expect(premios.map((p) => p.premioCentavos)).toEqual([600_000, 400_000, 0]);
  });

  it('percentuais que não somam 100: erro com a mensagem para a Maria (D20)', () => {
    expect(() => premiarTimes([time(1, 'A'), time(2, 'B')], PREMIO, [50, 30])).toThrow('Os percentuais precisam somar 100');
    expect(erroDosPercentuais([50, 30])).toBe('Os percentuais precisam somar 100. Hoje somam 80.');
    expect(erroDosPercentuais([50, 30, 20])).toBeNull();
    expect(erroDosPercentuais([50, 30.5, 19.5])).toBe('Os percentuais precisam ser números inteiros, como 50, 30 e 20.');
  });

  it('R$ 1.234,57 em 50/30/20: o prêmio é dividido entre as posições pelo maior resto (D20)', () => {
    const premios = premiarTimes([time(1, 'A'), time(2, 'B'), time(3, 'C'), time(4, 'D')], 123_457, PERCENTUAIS);
    expect(premios.map((p) => [p.time, p.premioCentavos])).toEqual([
      ['A', 61_729],
      ['B', 37_037],
      ['C', 24_691],
      ['D', 0],
    ]);
    expect(premios.reduce((soma, p) => soma + p.premioCentavos, 0)).toBe(123_457);
  });

  it('empate na fração entre posições: o centavo vai para a melhor colocada, não pelo nome', () => {
    const premios = premiarTimes([time(1, 'Zebras'), time(2, 'Águias')], 123_457, [50, 50]);
    expect(premios.map((p) => [p.time, p.premioCentavos])).toEqual([
      ['Zebras', 61_729],
      ['Águias', 61_728],
    ]);
  });

  it('times empatados somam os valores já arredondados das posições e dividem igual', () => {
    const premios = premiarTimes(
      [time(1, 'A'), time(2, 'B', 'empate em vitórias e kills'), time(2, 'C', 'empate em vitórias e kills')],
      123_457,
      PERCENTUAIS,
    );
    expect(premios.map((p) => p.premioCentavos)).toEqual([61_729, 30_864, 30_864]);
  });

});

describe('premiarTimes — menos times do que posições premiadas (D24)', () => {
  it('R$ 10.000 em 50/30/20 com 2 times: os 20% sem time são divididos igual: 1º R$ 6.000, 2º R$ 4.000', () => {
    const premios = premiarTimes([time(1, 'A'), time(2, 'B')], PREMIO, PERCENTUAIS);
    expect(premios.map((p) => p.premioCentavos)).toEqual([600_000, 400_000]);
  });

  it('nenhum dinheiro fica sem dono: a soma é sempre o prêmio', () => {
    for (const premio of [1, 7, 99, 1_000_001, 123_457]) {
      const premios = premiarTimes([time(1, 'A'), time(2, 'B')], premio, [40, 30, 20, 10]);
      expect(premios.reduce((s, p) => s + p.premioCentavos, 0)).toBe(premio);
    }
  });

  it('a sobra que não divide exato vai, centavo por centavo, primeiro ao mais bem colocado', () => {
    const premios = premiarTimes([time(1, 'A'), time(2, 'B'), time(3, 'C')], 1_000, [40, 30, 20, 10]);
    expect(premios.map((p) => [p.time, p.premioCentavos])).toEqual([['A', 434], ['B', 333], ['C', 233]]);
  });

  it('times empatados continuam somando as posições que ocupam, já com a sobra', () => {
    const premios = premiarTimes(
      [time(1, 'A', 'empate em vitórias e kills'), time(1, 'B', 'empate em vitórias e kills')],
      PREMIO,
      PERCENTUAIS,
    );
    expect(premios.map((p) => p.premioCentavos)).toEqual([500_000, 500_000]);
  });

  it('com times suficientes, nada muda', () => {
    const premios = premiarTimes([time(1, 'A'), time(2, 'B'), time(3, 'C')], PREMIO, PERCENTUAIS);
    expect(premios.map((p) => p.premioCentavos)).toEqual([500_000, 300_000, 200_000]);
  });

  it('nenhum time: erro claro (não há a quem pagar)', () => {
    expect(() => premiarTimes([], PREMIO, PERCENTUAIS)).toThrow('Não há times');
  });
});
