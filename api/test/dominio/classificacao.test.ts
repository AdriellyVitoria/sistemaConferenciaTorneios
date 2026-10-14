import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classificar, type CriterioClassificacao } from '../../src/dominio/classificacao';
import type { PartidaSite } from '../../src/dominio/comparacao';
import { lerPlanilha } from '../../src/dominio/planilha';

// Arquivos só lidos: nenhuma planilha, esperado ou site-oficial.json é alterado.
const RAIZ = path.resolve(__dirname, '../../..');
const SITE_OFICIAL: Record<string, PartidaSite> = JSON.parse(
  readFileSync(path.join(RAIZ, 'testes/site-oficial.json'), 'utf8'),
);
const SITE_SETEMBRO: Record<string, PartidaSite> = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/site-setembro.json'), 'utf8'),
);

/** Os dados oficiais de um cenário: as partidas da planilha, como o site as registra. */
function partidasOficiais(planilha: string, site: Record<string, PartidaSite>): PartidaSite[] {
  const resultado = lerPlanilha(readFileSync(path.join(RAIZ, planilha)));
  if (!resultado.ok) throw new Error(`planilha inválida: ${planilha}`);
  const ids = [...new Set(resultado.linhas.map((l) => l.idPartida))];
  return ids.map((id) => site[id]);
}

/**
 * Lê um *-classificacao.csv. O critério do arquivo de empate total é
 * "divisão igual (empate em vitórias e kills)": a classificação só afirma o que está entre
 * parênteses; "divisão igual" é do prêmio (parte 4).
 */
function esperado(nome: string) {
  const texto = readFileSync(path.join(RAIZ, 'testes/esperado', `${nome}-classificacao.csv`), 'utf8');
  return texto.split(/\r?\n/).filter(Boolean).slice(1).map((linha) => {
    const [posicao, time, vitorias, kills, , criterio] = linha.split(';');
    const entreParenteses = /\((.*)\)/.exec(criterio)?.[1];
    return {
      posicao: Number(posicao),
      time,
      vitorias: Number(vitorias),
      killsTime: Number(kills),
      criterio: (entreParenteses ?? (criterio || null)) as CriterioClassificacao | null,
    };
  });
}

describe('classificar — esperados de testes/esperado/', () => {
  const cenarios: [string, string, Record<string, PartidaSite>][] = [
    ['01-limpa', 'testes/planilhas/01-limpa.csv', SITE_OFICIAL],
    ['04-empate-em-kills', 'testes/planilhas/04-empate-em-kills.csv', SITE_OFICIAL],
    ['05-oito-times', 'testes/planilhas/05-oito-times.csv', SITE_OFICIAL],
    ['torneio-outubro', 'testes/planilhas/torneio-outubro.csv', SITE_OFICIAL],
    ['torneio-setembro', 'torneio-setembro.csv', SITE_SETEMBRO],
  ];

  for (const [nome, planilha, site] of cenarios) {
    it(`${nome}: posição, vitórias, kills e critério iguais ao arquivo`, () => {
      expect(classificar(partidasOficiais(planilha, site))).toEqual(esperado(nome));
    });
  }

  it('setembro: Corvos 2º pelas kills; Falcões e Tubarões dividem o 3º; Panteras pula para 5º', () => {
    const tabela = classificar(partidasOficiais('torneio-setembro.csv', SITE_SETEMBRO));
    expect(tabela.map((t) => [t.posicao, t.time, t.criterio])).toEqual([
      [1, 'Lobos', null],
      [2, 'Corvos', 'desempate por kills do time'],
      [3, 'Falcões', 'empate em vitórias e kills'],
      [3, 'Tubarões', 'empate em vitórias e kills'],
      [5, 'Panteras', null],
      [6, 'Serpentes', null],
    ]);
  });
});

// ---------------------------------------------------------------- casos pequenos

let proximoId = 1;
/** Partida com um jogador por time, só para controlar vencedor e kills. */
function partida(a: string, b: string, vencedor: string, killsA: number, killsB: number): PartidaSite {
  return {
    id: `#${proximoId++}`,
    data: '2026-09-05',
    times: [a, b],
    vencedor,
    jogadores: [
      { nick: `${a}-1`, time: a, minutos: 30, kills: killsA },
      { nick: `${b}-1`, time: b, minutos: 30, kills: killsB },
    ],
  };
}

describe('classificar — casos pequenos', () => {
  it('empate triplo em vitórias com kills diferentes: as kills decidem as três posições', () => {
    // A, B e C vencem uma vez cada (ciclo) e todos vencem D
    const tabela = classificar([
      partida('A', 'B', 'A', 10, 5),
      partida('B', 'C', 'B', 10, 5),
      partida('C', 'A', 'C', 10, 5),
      partida('A', 'D', 'A', 30, 0),
      partida('B', 'D', 'B', 20, 0),
      partida('C', 'D', 'C', 15, 0),
    ]);
    expect(tabela).toEqual([
      { posicao: 1, time: 'A', vitorias: 2, killsTime: 45, criterio: 'desempate por kills do time' },
      { posicao: 2, time: 'B', vitorias: 2, killsTime: 35, criterio: 'desempate por kills do time' },
      { posicao: 3, time: 'C', vitorias: 2, killsTime: 30, criterio: 'desempate por kills do time' },
      { posicao: 4, time: 'D', vitorias: 0, killsTime: 0, criterio: null },
    ]);
  });

  it('empate em vitórias e kills entre dois times: mesma posição, e o próximo pula', () => {
    // Corvos e Ursos: 1 vitória e 10 kills cada
    const tabela = classificar([
      partida('Lobos', 'Panteras', 'Lobos', 10, 0),
      partida('Lobos', 'Corvos', 'Lobos', 10, 5),
      partida('Lobos', 'Ursos', 'Lobos', 10, 5),
      partida('Corvos', 'Panteras', 'Corvos', 5, 0),
      partida('Ursos', 'Panteras', 'Ursos', 5, 0),
    ]);
    expect(tabela).toEqual([
      { posicao: 1, time: 'Lobos', vitorias: 3, killsTime: 30, criterio: null },
      { posicao: 2, time: 'Corvos', vitorias: 1, killsTime: 10, criterio: 'empate em vitórias e kills' },
      { posicao: 2, time: 'Ursos', vitorias: 1, killsTime: 10, criterio: 'empate em vitórias e kills' },
      { posicao: 4, time: 'Panteras', vitorias: 0, killsTime: 0, criterio: null },
    ]);
  });

  it('entre times na mesma posição, ordem alfabética de dicionário (acentos e maiúsculas não contam)', () => {
    const tabela = classificar([
      partida('Ursos', 'Águias', 'Ursos', 10, 10),
      partida('Águias', 'Ursos', 'Águias', 10, 10),
      partida('Ursos', 'Zebras', 'Ursos', 5, 0),
      partida('Águias', 'Zebras', 'Águias', 5, 0),
    ]);
    expect(tabela.map((t) => [t.posicao, t.time])).toEqual([
      [1, 'Águias'],
      [1, 'Ursos'],
      [3, 'Zebras'],
    ]);
  });

  it('times com zero vitórias entram na classificação', () => {
    const tabela = classificar([partida('Lobos', 'Serpentes', 'Lobos', 10, 3)]);
    expect(tabela).toEqual([
      { posicao: 1, time: 'Lobos', vitorias: 1, killsTime: 10, criterio: null },
      { posicao: 2, time: 'Serpentes', vitorias: 0, killsTime: 3, criterio: null },
    ]);
  });

  it('soma as kills de todos os jogadores do time, inclusive reservas', () => {
    const p = partida('Corvos', 'Tubarões', 'Corvos', 10, 8);
    p.jogadores.push({ nick: 'Tuca', time: 'Corvos', minutos: 19, kills: 5 });
    expect(classificar([p])[0]).toMatchObject({ time: 'Corvos', killsTime: 15 });
  });
});
