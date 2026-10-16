import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp as criarSiteSimulado } from '../../../site-oficial-simulado/src/app';
import { carregarPartidas } from '../../../site-oficial-simulado/src/dados';
import { criarApp } from '../../src/app';
import { executarRodada } from '../../src/conferencia/job';
import { criarClienteSiteOficial } from '../../src/conferencia/site-oficial';
import { COM_SENHA, SENHA_DE_TESTE } from '../ajudantes/senha';
import { conectarAoBancoDeTeste, esvaziarTabelas, relogioDoBanco } from './banco-de-teste';

// Senha única da organizadora (R3): as rotas da Maria pedem a senha; a página pública e o link do
// time, não. Um torneio de setembro calculado de verdade, para as rotas responderem 200.

const RAIZ = path.resolve(__dirname, '../../..');
const arquivo = (relativo: string) => path.join(RAIZ, relativo);
const DADOS_DO_SITE = [arquivo('testes/site-oficial.json'), arquivo('api/test/fixtures/site-setembro.json')];
const MINUTO = 60_000;

let bd: Knex;
let relogio: () => Date;
let api: Server;
let site: Server;
let base: string;
let id: number;
let codigoPublico: string;
let codigoDosCorvos: string;

async function pedir(metodo: string, caminho: string, { corpo, cabecalhos = COM_SENHA }: { corpo?: unknown; cabecalhos?: Record<string, string> } = {}) {
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { ...cabecalhos, ...(corpo instanceof Uint8Array ? {} : { 'content-type': 'application/json' }) },
    body: corpo === undefined ? undefined : corpo instanceof Uint8Array ? corpo : JSON.stringify(corpo),
  });
  const texto = await resposta.text();
  return { status: resposta.status, texto, corpo: resposta.headers.get('content-type')?.includes('json') ? JSON.parse(texto) : null };
}

async function conferirTudo(torneioId: number, urlDoSite: string) {
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

beforeAll(async () => {
  bd = conectarAoBancoDeTeste();
  relogio = await relogioDoBanco(bd);
  api = criarApp({ bd, verificarBanco: async () => {}, agora: () => relogio(), senhaDaOrganizadora: SENHA_DE_TESTE }).listen(0);
  await new Promise((pronto) => api.once('listening', pronto));
  base = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
  site = criarSiteSimulado(carregarPartidas(DADOS_DO_SITE)).listen(0, '127.0.0.1');
  await new Promise((pronto) => site.once('listening', pronto));

  await esvaziarTabelas(bd);
  const { corpo } = await pedir('POST', '/torneios', { corpo: { nome: 'Torneio de Setembro/2026', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' } });
  id = corpo.id;
  expect((await pedir('PUT', `/torneios/${id}/planilha`, { corpo: readFileSync(arquivo('torneio-setembro.csv')) })).status).toBe(200);
  await conferirTudo(id, `http://127.0.0.1:${(site.address() as AddressInfo).port}`);
  await pedir('POST', `/torneios/${id}/pendencias/ciente-de-todas`);
  expect((await pedir('POST', `/torneios/${id}/calculo`)).status).toBe(200);
  const links = (await pedir('GET', `/torneios/${id}/links`)).corpo;
  codigoPublico = links.publico.codigo;
  codigoDosCorvos = links.times.find((t: { time: string }) => t.time === 'Corvos').codigo;
});
afterAll(async () => {
  site.closeAllConnections();
  await new Promise<void>((fechado) => site.close(() => fechado()));
  await new Promise<void>((fechado) => api.close(() => fechado()));
  await bd.destroy();
});

const SEM_SENHA = {};
const SENHA_ERRADA = { authorization: `Bearer ${SENHA_DE_TESTE}-errada` };
const rotasDaMaria = () => ['/torneios', `/torneios/${id}`, `/torneios/${id}/links`, `/torneios/${id}/resultado`, `/torneios/${id}/resultado.csv`, `/torneios/${id}/pendencias`];

describe('rotas da Maria pedem a senha (R3)', () => {
  it('sem senha: 401 com "Acesso só da organizadora." em todas, e nada do torneio na resposta', async () => {
    for (const caminho of rotasDaMaria()) {
      const { status, corpo, texto } = await pedir('GET', caminho, { cabecalhos: SEM_SENHA });
      expect(status, caminho).toBe(401);
      expect(corpo, caminho).toEqual({ erro: 'Acesso só da organizadora.' });
      expect(texto, caminho).not.toContain('Corvos');
    }
  });

  it('senha errada: 401 em todas', async () => {
    for (const caminho of rotasDaMaria()) {
      expect((await pedir('GET', caminho, { cabecalhos: SENHA_ERRADA })).status, caminho).toBe(401);
    }
  });

  it('com a senha: 200 em todas, com os dados', async () => {
    for (const caminho of rotasDaMaria()) {
      expect((await pedir('GET', caminho)).status, caminho).toBe(200);
    }
    expect((await pedir('GET', `/torneios/${id}/resultado`)).corpo.torneio.nome).toBe('Torneio de Setembro/2026');
    expect((await pedir('GET', `/torneios/${id}/resultado.csv`)).texto).toContain('Tuca');
  });

  it('o que muda dados também pede a senha: criar, remover e calcular, sem senha, dão 401 e nada muda', async () => {
    const antes = await bd('torneios').count({ n: '*' }).first();
    expect((await pedir('POST', '/torneios', { cabecalhos: SEM_SENHA, corpo: { nome: 'Intruso', premioCentavos: 100, percentuais: [100], modoDivisao: 'minutos' } })).status).toBe(401);
    expect((await pedir('DELETE', `/torneios/${id}`, { cabecalhos: SEM_SENHA })).status).toBe(401);
    expect((await pedir('POST', `/torneios/${id}/calculo`, { cabecalhos: SEM_SENHA })).status).toBe(401);
    expect(await bd('torneios').count({ n: '*' }).first()).toEqual(antes);
  });
});

describe('páginas por link não pedem senha (D11)', () => {
  it('/publico/:codigo e /time/:codigo: 200 sem senha', async () => {
    const publico = await pedir('GET', `/publico/${codigoPublico}`, { cabecalhos: SEM_SENHA });
    expect(publico.status).toBe(200);
    expect(publico.corpo.torneio.nome).toBe('Torneio de Setembro/2026');
    const time = await pedir('GET', `/time/${codigoDosCorvos}`, { cabecalhos: SEM_SENHA });
    expect(time.status).toBe(200);
    expect(time.corpo.time.nome).toBe('Corvos');
  });

  it('com uma senha errada no cabeçalho, continuam abrindo: a senha não é conferida ali', async () => {
    expect((await pedir('GET', `/publico/${codigoPublico}`, { cabecalhos: SENHA_ERRADA })).status).toBe(200);
    expect((await pedir('GET', `/time/${codigoDosCorvos}`, { cabecalhos: SENHA_ERRADA })).status).toBe(200);
  });

  it('código errado continua 404, e não 401', async () => {
    expect((await pedir('GET', `/publico/${'A'.repeat(32)}`, { cabecalhos: SEM_SENHA })).status).toBe(404);
    expect((await pedir('GET', `/time/${'A'.repeat(32)}`, { cabecalhos: SEM_SENHA })).status).toBe(404);
  });
});
