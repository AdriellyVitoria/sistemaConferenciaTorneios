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
const MINUTO = 60_000;

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
  return { status: resposta.status, cabecalhos: resposta.headers, corpo: await resposta.json() };
}

/** Roda o job até o site responder tudo (o relógio avança até cada nova tentativa). */
async function conferirTudo(torneioId: number) {
  const cliente = criarClienteSiteOficial({ urlBase: urlDoSite, tempoLimiteMs: 5_000 });
  let agora = new Date(relogio().getTime() + 2_000);
  for (let rodada = 0; rodada < 20; rodada++) {
    await executarRodada({ bd, site: cliente, agora: () => agora, intervalosMs: [MINUTO], lote: 3, presaAposMs: 2 * MINUTO });
    const proxima: { p: Date | null } | undefined = await bd('partidas').where({ torneio_id: torneioId, status_conferencia: 'aguardando' }).min({ p: 'proxima_tentativa_em' }).first();
    if (!proxima?.p) return;
    agora = new Date(Math.max(agora.getTime(), proxima.p.getTime()));
  }
  throw new Error('o site não respondeu todas as partidas');
}

/** Importa, confere e dá Ciente em tudo; com `calcular`, também calcula. */
async function torneio(planilha: string, { calcular = true } = {}): Promise<number> {
  const { corpo } = await pedir('POST', '/torneios', { nome: 'Torneio de Setembro/2026', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
  expect((await pedir('PUT', `/torneios/${corpo.id}/planilha`, readFileSync(arquivo(planilha)))).status).toBe(200);
  await conferirTudo(corpo.id);
  await pedir('POST', `/torneios/${corpo.id}/pendencias/ciente-de-todas`);
  if (calcular) expect((await pedir('POST', `/torneios/${corpo.id}/calculo`)).status).toBe(200);
  return corpo.id;
}
const setembro = (opcoes?: { calcular?: boolean }) => torneio('torneio-setembro.csv', opcoes);

async function links(id: number) {
  const { corpo } = await pedir('GET', `/torneios/${id}/links`);
  return corpo as { publico: { codigo: string }; times: { time: string; posicao: number; premioCentavos: number; codigo: string }[] };
}
const codigoDo = async (id: number, time: string) => (await links(id)).times.find((t) => t.time === time)!.codigo;

const NICKS_DE_SETEMBRO_FORA_DOS_CORVOS = [
  'xXSniperXx', 'Lua_', 'Pipoca', 'R4mbo', 'Dona.Tank',
  'Falk', 'Kiwi', 'Dudu.pro', 'Marreta', 'Sol',
  'Sombra', 'Pantera_X', 'Mel', 'Tchê', 'Rafa.K',
  'Bote', 'Cobrinha', 'Kaio_BR', 'Naja', 'Víbora',
];

describe('GET /time/:codigo', () => {
  it('Corvos: os 6 jogadores dos Corvos, Tuca com R$ 65,90 e o centavo, e o total de R$ 3.000,00', async () => {
    const id = await setembro();
    const { publico } = await links(id);
    const { status, cabecalhos, corpo } = await pedir('GET', `/time/${await codigoDo(id, 'Corvos')}`);

    expect(status).toBe(200);
    expect(cabecalhos.get('x-robots-tag')).toBe('noindex');
    expect(corpo).toMatchObject({
      torneio: { nome: 'Torneio de Setembro/2026' },
      calculadoEm: (await pedir('GET', `/torneios/${id}/resultado`)).corpo.calculadoEm,
      time: { nome: 'Corvos', posicao: 2, premioCentavos: 300_000, baseUsada: 'minutos', baseTime: 865 },
      comoFoiCalculado: { premioTotalCentavos: 1_000_000, percentualDaPosicao: 30, criterio: 'desempate por kills do time', empate: null, modoDivisao: 'minutos' },
      totalCentavos: 300_000,
      codigoPublico: publico.codigo,
    });
    expect(corpo.jogadores.map((j: { nick: string; premioCentavos: number }) => [j.nick, j.premioCentavos])).toEqual([
      ['Corvinho', 60_000], ['M4theus', 60_000], ['Nina.exe', 60_000], ['Zeca', 60_000], ['Bia.gg', 53_410], ['Tuca', 6_590],
    ]);
    expect(corpo.jogadores.find((j: { nick: string }) => j.nick === 'Tuca')).toEqual({
      nick: 'Tuca', base: 19, baseUsada: 'minutos', centesimosDePercentual: 220, premioCentavos: 6_590, recebeuCentavo: true, explicacao: null,
    });
    expect(corpo.jogadores.reduce((s: number, j: { premioCentavos: number }) => s + j.premioCentavos, 0)).toBe(300_000);
  });

  it('nada de outros times: nenhum nick nem nome de outro time, nem o id do torneio', async () => {
    const id = await setembro();
    const { corpo } = await pedir('GET', `/time/${await codigoDo(id, 'Corvos')}`);
    const texto = JSON.stringify(corpo);
    for (const outro of [...NICKS_DE_SETEMBRO_FORA_DOS_CORVOS, 'Lobos', 'Falcões', 'Tubarões', 'Panteras', 'Serpentes']) {
      expect(texto).not.toContain(outro);
    }
    expect(texto).not.toMatch(/"(id|torneioId|torneio_id)":/);
  });

  it('Falcões: o empate dividido (3º e 4º lugar, 2 times), R$ 1.000,00 em 5 × R$ 200,00', async () => {
    const id = await setembro();
    const { corpo } = await pedir('GET', `/time/${await codigoDo(id, 'Falcões')}`);
    expect(corpo.time).toMatchObject({ nome: 'Falcões', posicao: 3, premioCentavos: 100_000 });
    expect(corpo.comoFoiCalculado).toEqual({
      premioTotalCentavos: 1_000_000, percentualDaPosicao: 20, criterio: 'divisão igual (empate em vitórias e kills)',
      empate: { posicoes: [3, 4], percentuais: [20, 0], quantidadeDeTimes: 2 }, modoDivisao: 'minutos',
    });
    expect(corpo.jogadores.map((j: { premioCentavos: number }) => j.premioCentavos)).toEqual([20_000, 20_000, 20_000, 20_000, 20_000]);
    expect(corpo.totalCentavos).toBe(100_000);
    expect(JSON.stringify(corpo)).not.toContain('Tubarões');
  });

  it('cenário 07: Garra aparece nos Leões só com os minutos e a parte dos Leões', async () => {
    const id = await torneio('testes/planilhas/07-jogador-em-dois-times.csv');
    const { corpo } = await pedir('GET', `/time/${await codigoDo(id, 'Leões')}`);
    const garra = corpo.jogadores.find((j: { nick: string }) => j.nick === 'Garra');
    expect(garra).toMatchObject({ base: 178, premioCentavos: 40_000 });
    expect(corpo.time.baseTime).toBe(890);

    // pelos Ursos, Garra também jogou, mas esses minutos ficam fora do extrato dos Leões
    const [calculo] = await bd('calculos').where({ torneio_id: id });
    const pelosUrsos = await bd('premios_jogador').where({ calculo_id: calculo.id, time: 'Ursos', nick: 'Garra' }).first();
    expect(pelosUrsos.minutos).toBeGreaterThan(0);
    expect(JSON.stringify(corpo)).not.toContain('Ursos');
    // Ursos ficou sem prêmio: não tem link
    expect((await links(id)).times.map((t) => t.time)).not.toContain('Ursos');
  });

  it('código público e códigos errados: 404, sempre a mesma resposta, com noindex', async () => {
    const id = await setembro();
    const { publico, times: [qualquer] } = await links(id);
    const trocado = qualquer.codigo.replace(/[a-z]/, (l) => l.toUpperCase());

    const errados = [publico.codigo, 'A'.repeat(32), trocado, 'curto', String(id), `${qualquer.codigo}x`, encodeURIComponent("' OR 1=1 --")];
    const respostas = await Promise.all(errados.map((c) => pedir('GET', `/time/${c}`)));
    for (const r of respostas) {
      expect(r.status).toBe(404);
      expect(r.corpo).toEqual({ erro: 'Página não encontrada.' });
      expect(r.cabecalhos.get('x-robots-tag')).toBe('noindex');
    }
  });
});

describe('GET /torneios/:id/links', () => {
  it('setembro: o código público e o de cada time premiado, na ordem da classificação', async () => {
    const id = await setembro();
    const { status, corpo } = await pedir('GET', `/torneios/${id}/links`);
    expect(status).toBe(200);
    const [calculo] = await bd('calculos').where({ torneio_id: id });
    expect(corpo.publico).toEqual({ codigo: calculo.codigo_publico });
    expect(corpo.times.map((t: { time: string; posicao: number; premioCentavos: number }) => [t.time, t.posicao, t.premioCentavos])).toEqual([
      ['Lobos', 1, 500_000], ['Corvos', 2, 300_000], ['Falcões', 3, 100_000], ['Tubarões', 3, 100_000],
    ]);
    for (const t of corpo.times) expect(t.codigo).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('os códigos são os mesmos a cada leitura (a Maria copia a qualquer momento)', async () => {
    const id = await setembro();
    expect(await links(id)).toEqual(await links(id));
  });

  it('antes do cálculo: 409; torneio que não existe: 404', async () => {
    const id = await setembro({ calcular: false });
    const antes = await pedir('GET', `/torneios/${id}/links`);
    expect(antes.status).toBe(409);
    expect(antes.corpo.erro).toBe('O torneio ainda não foi calculado.');
    expect((await pedir('GET', '/torneios/999999/links')).status).toBe(404);
  });
});
