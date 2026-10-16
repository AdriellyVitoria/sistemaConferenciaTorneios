import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarApp as criarSiteSimulado } from '../../../site-oficial-simulado/src/app';
import { carregarPartidas } from '../../../site-oficial-simulado/src/dados';
import { criarApp } from '../../src/app';
import * as migracaoDosCodigos from '../../src/banco/migrations/010_cria_codigos_de_acesso';
import { executarRodada } from '../../src/conferencia/job';
import { criarClienteSiteOficial } from '../../src/conferencia/site-oficial';
import { CRITERIO_DE_DESEMPATE } from '../../src/dominio/pagina-publica';
import { conectarAoBancoDeTeste, esvaziarTabelas, relogioDoBanco } from './banco-de-teste';
import { COM_SENHA, SENHA_DE_TESTE } from '../ajudantes/senha';

const RAIZ = path.resolve(__dirname, '../../..');
const arquivo = (relativo: string) => path.join(RAIZ, relativo);
const DADOS_DO_SITE = [arquivo('testes/site-oficial.json'), arquivo('api/test/fixtures/site-setembro.json')];
const FORMATO = /^[A-Za-z0-9_-]{32}$/;

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
  api = criarApp({ bd, verificarBanco: async () => {}, agora: () => relogio(), senhaDaOrganizadora: SENHA_DE_TESTE }).listen(0);
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
    headers: { ...COM_SENHA, ...(corpo instanceof Uint8Array ? {} : { 'content-type': 'application/json' }) },
    body: corpo === undefined ? undefined : corpo instanceof Uint8Array ? corpo : JSON.stringify(corpo),
  });
  return { status: resposta.status, cabecalhos: resposta.headers, corpo: await resposta.json() };
}

/** Setembro importado, conferido e com os 3 Cientes: pronto para calcular. */
async function setembroPronto(): Promise<number> {
  const { corpo } = await pedir('POST', '/torneios', { nome: 'Torneio de Setembro/2026', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
  await pedir('PUT', `/torneios/${corpo.id}/planilha`, readFileSync(arquivo('torneio-setembro.csv')));
  await executarRodada({
    bd, site: criarClienteSiteOficial({ urlBase: urlDoSite, tempoLimiteMs: 5_000 }),
    agora: () => new Date(relogio().getTime() + 2_000), intervalosMs: [60_000], lote: 3, presaAposMs: 120_000,
  });
  await pedir('POST', `/torneios/${corpo.id}/pendencias/ciente-de-todas`);
  return corpo.id;
}
async function setembroCalculado(): Promise<number> {
  const id = await setembroPronto();
  expect((await pedir('POST', `/torneios/${id}/calculo`)).status).toBe(200);
  return id;
}

/** Os códigos gravados do torneio: o público e o de cada time, por nome do time. */
async function codigosDo(torneioId: number) {
  const calculos = await bd('calculos').where({ torneio_id: torneioId });
  const times = await bd('codigos_time as c')
    .join('premios_time as t', 't.id', 'c.premio_time_id')
    .join('calculos as k', 'k.id', 't.calculo_id')
    .where('k.torneio_id', torneioId)
    .orderBy('t.time')
    .select('t.time', 'c.codigo');
  return { publicos: calculos.map((c) => c.codigo_publico as string), times: times as { time: string; codigo: string }[] };
}

describe('códigos gerados no cálculo (D11)', () => {
  it('setembro: 1 código público e 1 por time premiado (Corvos, Falcões, Lobos, Tubarões), todos diferentes', async () => {
    const id = await setembroCalculado();
    const { publicos, times } = await codigosDo(id);

    expect(publicos).toHaveLength(1);
    expect(times.map((t) => t.time)).toEqual(['Corvos', 'Falcões', 'Lobos', 'Tubarões']);
    const todos = [...publicos, ...times.map((t) => t.codigo)];
    for (const codigo of todos) expect(codigo).toMatch(FORMATO);
    expect(new Set(todos).size).toBe(5);
  });

  it('antes do cálculo, não existe código', async () => {
    const id = await setembroPronto();
    const { publicos, times } = await codigosDo(id);
    expect(publicos).toEqual([]);
    expect(times).toEqual([]);
    expect(await bd('codigos_time')).toEqual([]);
  });

  it('dois cálculos ao mesmo tempo: um conjunto de códigos só', async () => {
    const id = await setembroPronto();
    const respostas = await Promise.all([1, 2, 3].map(() => pedir('POST', `/torneios/${id}/calculo`)));
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409, 409]);

    const { publicos, times } = await codigosDo(id);
    expect(publicos).toHaveLength(1);
    expect(times).toHaveLength(4);
    expect(await bd('codigos_time')).toHaveLength(4);
  });

  it('o código diferencia maiúsculas no banco: "abc" e "ABC" são códigos diferentes', async () => {
    const id = await setembroCalculado();
    const { publicos: [codigo] } = await codigosDo(id);
    const trocado = codigo.replace(/[a-z]/, (l) => l.toUpperCase());
    expect(await bd('calculos').where({ codigo_publico: trocado }).first()).toBeUndefined();
  });
});

describe('GET /publico/:codigo', () => {
  it('setembro: nome, data, regras e classificação, e nada mais', async () => {
    const id = await setembroCalculado();
    const { publicos: [codigo] } = await codigosDo(id);
    const { status, cabecalhos, corpo } = await pedir('GET', `/publico/${codigo}`);

    expect(status).toBe(200);
    expect(cabecalhos.get('x-robots-tag')).toBe('noindex');
    expect(corpo).toEqual({
      torneio: { nome: 'Torneio de Setembro/2026' },
      calculadoEm: expect.any(String),
      regras: { premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos', criterioDeDesempate: CRITERIO_DE_DESEMPATE },
      classificacao: [
        { posicao: 1, time: 'Lobos', vitorias: 5, killsTime: 353, premioCentavos: 500_000, criterio: null },
        { posicao: 2, time: 'Corvos', vitorias: 3, killsTime: 368, premioCentavos: 300_000, criterio: 'desempate por kills do time' },
        { posicao: 3, time: 'Falcões', vitorias: 3, killsTime: 310, premioCentavos: 100_000, criterio: 'divisão igual (empate em vitórias e kills)' },
        { posicao: 3, time: 'Tubarões', vitorias: 3, killsTime: 310, premioCentavos: 100_000, criterio: 'divisão igual (empate em vitórias e kills)' },
        { posicao: 5, time: 'Panteras', vitorias: 1, killsTime: 269, premioCentavos: 0, criterio: null },
        { posicao: 6, time: 'Serpentes', vitorias: 0, killsTime: 249, premioCentavos: 0, criterio: null },
      ],
    });
    // a data é a do cálculo
    expect(corpo.calculadoEm).toBe((await pedir('GET', `/torneios/${id}/resultado`)).corpo.calculadoEm);
  });

  it('nenhum nick nem valor de jogador (D11)', async () => {
    const id = await setembroCalculado();
    const { publicos: [codigo] } = await codigosDo(id);
    const texto = JSON.stringify((await pedir('GET', `/publico/${codigo}`)).corpo);

    const nicks: string[] = (await bd('premios_jogador')).map((j) => j.nick);
    expect(nicks).toHaveLength(31);
    for (const nick of nicks) expect(texto).not.toContain(nick);
    expect(texto).not.toContain('6590'); // Tuca
    expect(texto).not.toContain('53410'); // Bia.gg
    // nenhum campo de jogador ("minutos" aparece só como valor, o modo de divisão)
    expect(texto).not.toMatch(/"(jogadores|nick|minutos|kills|base|baseTime|explicacao)":/);
  });

  it('só o resultado congelado: mudar o torneio depois não muda a página', async () => {
    const id = await setembroCalculado();
    const { publicos: [codigo] } = await codigosDo(id);
    await bd('torneios').where({ id }).update({ premio_centavos: 1, percentuais: JSON.stringify([100]), modo_divisao: 'kills' });
    const { corpo } = await pedir('GET', `/publico/${codigo}`);
    expect(corpo.regras).toMatchObject({ premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
    expect(corpo.torneio.nome).toBe('Torneio de Setembro/2026');
  });

  it('código errado: 404, sempre a mesma resposta, sem dizer se o torneio existe', async () => {
    const id = await setembroCalculado();
    const { publicos: [codigo], times: [codigoDeTime] } = await codigosDo(id);
    const trocado = codigo.replace(/[a-z]/, (l) => l.toUpperCase());

    const errados = [
      'A'.repeat(32), // no formato, mas não existe
      trocado, // o certo com uma letra em maiúscula
      codigoDeTime.codigo, // o código de um time não abre a página pública
      'curto',
      String(id), // o id interno do torneio
      `${codigo}x`,
      encodeURIComponent("' OR 1=1 --"),
    ];
    const respostas = await Promise.all(errados.map((c) => pedir('GET', `/publico/${c}`)));
    for (const r of respostas) {
      expect(r.status).toBe(404);
      expect(r.corpo).toEqual({ erro: 'Página não encontrada.' });
      expect(r.cabecalhos.get('x-robots-tag')).toBe('noindex');
    }
  });
});

describe('migration 010: torneios calculados antes dela ganham os códigos', () => {
  it('desfaz a migration, grava um cálculo "antigo", refaz: público e times premiados com código', async () => {
    const { corpo: torneio } = await pedir('POST', '/torneios', { nome: 'Antigo', premioCentavos: 1_000_000, percentuais: [60, 40], modoDivisao: 'minutos' });

    await migracaoDosCodigos.down(bd);
    try {
      // como ficava um cálculo antes desta mudança: sem código nenhum
      const [calculoId] = await bd('calculos').insert({
        torneio_id: torneio.id, calculado_em: new Date('2026-10-15T13:00:00.000Z'), premio_centavos: 1_000_000, percentuais: JSON.stringify([60, 40]), modo_divisao: 'minutos',
      });
      await bd('premios_time').insert([
        { calculo_id: calculoId, ordem: 0, posicao: 1, time: 'Lobos', vitorias: 2, kills_time: 90, premio_centavos: 600_000, criterio: null, recebeu_centavo: false },
        { calculo_id: calculoId, ordem: 1, posicao: 2, time: 'Corvos', vitorias: 1, kills_time: 80, premio_centavos: 400_000, criterio: null, recebeu_centavo: false },
        { calculo_id: calculoId, ordem: 2, posicao: 3, time: 'Serpentes', vitorias: 0, kills_time: 70, premio_centavos: 0, criterio: null, recebeu_centavo: false },
      ]);
    } finally {
      await migracaoDosCodigos.up(bd);
    }

    const { publicos, times } = await codigosDo(torneio.id);
    expect(publicos).toHaveLength(1);
    expect(publicos[0]).toMatch(FORMATO);
    expect(times.map((t) => t.time)).toEqual(['Corvos', 'Lobos']);
    for (const t of times) expect(t.codigo).toMatch(FORMATO);

    const { status, corpo } = await pedir('GET', `/publico/${publicos[0]}`);
    expect(status).toBe(200);
    expect(corpo.classificacao.map((t: { time: string }) => t.time)).toEqual(['Lobos', 'Corvos', 'Serpentes']);
  });
});
