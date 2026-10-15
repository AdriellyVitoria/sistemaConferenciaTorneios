import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarApp as criarSiteSimulado } from '../../../site-oficial-simulado/src/app';
import { carregarPartidas } from '../../../site-oficial-simulado/src/dados';
import { criarApp } from '../../src/app';
import { executarRodada } from '../../src/conferencia/job';
import { criarClienteSiteOficial } from '../../src/conferencia/site-oficial';
import { conectarAoBancoDeTeste, esvaziarTabelas, relogioDoBanco } from './banco-de-teste';

const RAIZ = path.resolve(__dirname, '../../..');
const arquivo = (relativo: string) => path.join(RAIZ, relativo);
const DADOS_DO_SITE = [arquivo('testes/site-oficial.json'), arquivo('api/test/fixtures/site-setembro.json')];

let bd: Knex;
/** O relógio do MySQL: a API e o job usam o mesmo relógio que grava a próxima tentativa na importação. */
let relogio: () => Date;
let api: Server;
let site: Server;
let base: string;
let urlDoSite: string;

beforeAll(async () => {
  bd = conectarAoBancoDeTeste();
  relogio = await relogioDoBanco(bd);
  api = criarApp({ bd, verificarBanco: async () => {}, agora: () => relogio() }).listen(0);
  await new Promise((pronto) => api.once('listening', pronto));
  base = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((fechado) => api.close(() => fechado()));
  await bd.destroy();
});
beforeEach(async () => {
  await esvaziarTabelas(bd);
  site = criarSiteSimulado(carregarPartidas(DADOS_DO_SITE)).listen(0, '127.0.0.1');
  await new Promise((pronto) => site.once('listening', pronto));
  urlDoSite = `http://127.0.0.1:${(site.address() as AddressInfo).port}`;
});
afterEach(async () => {
  site.closeAllConnections();
  await new Promise<void>((fechado) => site.close(() => fechado()));
});

async function pedir(metodo: string, caminho: string, corpo?: unknown) {
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: corpo instanceof Uint8Array ? {} : { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : corpo instanceof Uint8Array ? corpo : JSON.stringify(corpo),
  });
  return { status: resposta.status, corpo: await resposta.json() };
}

/** Setembro importado e conferido; com `calcular`, também com os 3 Cientes e calculado. */
async function setembro({ calcular = true } = {}): Promise<number> {
  const { corpo } = await pedir('POST', '/torneios', { nome: 'Torneio de Setembro/2026', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
  await pedir('PUT', `/torneios/${corpo.id}/planilha`, readFileSync(arquivo('torneio-setembro.csv')));
  await executarRodada({
    bd, site: criarClienteSiteOficial({ urlBase: urlDoSite, tempoLimiteMs: 5_000 }),
    agora: () => new Date(relogio().getTime() + 2_000), intervalosMs: [60_000], lote: 3, presaAposMs: 120_000,
  });
  if (calcular) {
    await pedir('POST', `/torneios/${corpo.id}/pendencias/ciente-de-todas`);
    expect((await pedir('POST', `/torneios/${corpo.id}/calculo`)).status).toBe(200);
  }
  return corpo.id;
}

describe('GET /torneios/:id/resultado', () => {
  it('setembro: configuração, data, classificação com o critério e jogadores, do que foi gravado', async () => {
    const id = await setembro();
    const { status, corpo } = await pedir('GET', `/torneios/${id}/resultado`);

    expect(status).toBe(200);
    expect(corpo).toMatchObject({
      torneio: { id, nome: 'Torneio de Setembro/2026' },
      premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos', calculadoEm: expect.any(String),
    });
    expect(corpo.times.map((t: { posicao: number; time: string; vitorias: number; killsTime: number; premioCentavos: number; criterio: string | null }) =>
      [t.posicao, t.time, t.vitorias, t.killsTime, t.premioCentavos, t.criterio])).toEqual([
      [1, 'Lobos', 5, 353, 500_000, null],
      [2, 'Corvos', 3, 368, 300_000, 'desempate por kills do time'],
      [3, 'Falcões', 3, 310, 100_000, 'divisão igual (empate em vitórias e kills)'],
      [3, 'Tubarões', 3, 310, 100_000, 'divisão igual (empate em vitórias e kills)'],
      [5, 'Panteras', 1, 269, 0, null],
      [6, 'Serpentes', 0, 249, 0, null],
    ]);
    expect(corpo.jogadores.find((j: { nick: string }) => j.nick === 'Tuca')).toEqual({
      time: 'Corvos', posicao: 2, nick: 'Tuca', minutos: 19, kills: 5, base: 19, baseTime: 865, baseUsada: 'minutos',
      premioCentavos: 6_590, recebeuCentavo: true, explicacao: null,
    });
    expect(corpo.jogadores).toHaveLength(31);
  });

  it('é o que foi gravado: mudar o torneio depois não muda o resultado (nada é recalculado)', async () => {
    const id = await setembro();
    await bd('torneios').where({ id }).update({ premio_centavos: 1, modo_divisao: 'kills' });
    const { corpo } = await pedir('GET', `/torneios/${id}/resultado`);
    expect(corpo).toMatchObject({ premioCentavos: 1_000_000, modoDivisao: 'minutos' });
    expect(corpo.jogadores.find((j: { nick: string }) => j.nick === 'Tuca').premioCentavos).toBe(6_590);
  });

  it('antes do cálculo: 409', async () => {
    const id = await setembro({ calcular: false });
    const { status, corpo } = await pedir('GET', `/torneios/${id}/resultado`);
    expect(status).toBe(409);
    expect(corpo.erro).toBe('O torneio ainda não foi calculado.');
  });

  it('torneio que não existe: 404', async () => {
    expect((await pedir('GET', '/torneios/999999/resultado')).status).toBe(404);
  });
});

describe('GET /torneios/:id/resultado.csv', () => {
  it('UTF-8 com BOM e ";": abre no Excel com os acentos certos, e a soma dá exatamente 10.000,00', async () => {
    const id = await setembro();
    const resposta = await fetch(`${base}/torneios/${id}/resultado.csv`);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toBe('text/csv; charset=utf-8');

    const bytes = new Uint8Array(await resposta.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // o BOM: o Excel reconhece o UTF-8
    const texto = new TextDecoder('utf-8').decode(bytes.slice(3));
    expect(texto).toContain('Falcões');
    expect(texto).toContain('Tubarões');

    const [cabecalho, ...linhas] = texto.split('\r\n').filter(Boolean);
    expect(cabecalho).toBe('Posição;Time;Nick;Minutos;Kills;Valor (R$);Centavo de arredondamento');
    expect(linhas).toHaveLength(31);
    const centavos = linhas.map((l) => {
      const [reais, cent] = l.split(';')[5].split(',');
      return Number(reais) * 100 + Number(cent);
    });
    expect(centavos.reduce((s, c) => s + c, 0)).toBe(1_000_000);

    expect(linhas).toContain('2;Corvos;Tuca;19;5;65,90;sim');
    // ordem: posição, valor maior, nick; Falcões e Tubarões juntos no 3º lugar
    expect(linhas.map((l) => l.split(';')[0])).toEqual([...'11111', ...'222222', ...'3333333333', ...'55555', ...'66666']);
    expect(linhas.slice(0, 1)[0]).toMatch(/^1;Lobos;Dona\.Tank;211;\d+;1000,00;não$/);
    expect(linhas[11].split(';').slice(0, 3)).toEqual(['3', 'Falcões', 'Dudu.pro']);
  });

  it('o nome do arquivo tem o nome do torneio', async () => {
    const id = await setembro();
    const disposicao = (await fetch(`${base}/torneios/${id}/resultado.csv`)).headers.get('content-disposition')!;
    expect(disposicao).toContain('attachment');
    expect(disposicao).toContain('filename="resultado-torneio-de-setembro-2026.csv"');
    expect(disposicao).toContain(`filename*=UTF-8''${encodeURIComponent('resultado-Torneio de Setembro-2026.csv')}`);
  });

  it('antes do cálculo: 409', async () => {
    const id = await setembro({ calcular: false });
    const resposta = await fetch(`${base}/torneios/${id}/resultado.csv`);
    expect(resposta.status).toBe(409);
    expect((await resposta.json()).erro).toBe('O torneio ainda não foi calculado.');
  });

  it('torneio que não existe: 404', async () => {
    expect((await fetch(`${base}/torneios/999999/resultado.csv`)).status).toBe(404);
  });
});
