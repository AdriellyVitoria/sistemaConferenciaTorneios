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
import { conectarAoBancoDeTeste, esvaziarTabelas } from './banco-de-teste';

const RAIZ = path.resolve(__dirname, '../../..');
const arquivo = (relativo: string) => path.join(RAIZ, relativo);
const DADOS_DO_SITE = [arquivo('testes/site-oficial.json'), arquivo('api/test/fixtures/site-setembro.json')];

let bd: Knex;
let api: Server;
let site: Server;
let base: string;
let urlDoSite: string;

beforeAll(async () => {
  bd = conectarAoBancoDeTeste();
  api = criarApp({ bd, verificarBanco: async () => {} }).listen(0);
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

const conferirTudo = () =>
  executarRodada({
    bd,
    site: criarClienteSiteOficial({ urlBase: urlDoSite, tempoLimiteMs: 5_000 }),
    agora: () => new Date(Date.now() + 2_000),
    intervalosMs: [60_000],
    lote: 3,
    presaAposMs: 120_000,
  });

async function torneioCom(conteudo: Uint8Array, { conferir = true, percentuais = [50, 30, 20] } = {}): Promise<number> {
  const { corpo } = await pedir('POST', '/torneios', { nome: 'Teste', premioCentavos: 1_000_000, percentuais, modoDivisao: 'minutos' });
  expect((await pedir('PUT', `/torneios/${corpo.id}/planilha`, conteudo)).status).toBe(200);
  if (conferir) await conferirTudo();
  return corpo.id;
}
const setembro = () => readFileSync(arquivo('torneio-setembro.csv'));
/** Setembro pronto para calcular: conferido e com os 3 Cientes. */
async function setembroPronto() {
  const id = await torneioCom(setembro());
  expect((await pedir('POST', `/torneios/${id}/pendencias/ciente-de-todas`)).corpo).toEqual({ marcadas: 3 });
  return id;
}
const calcular = (id: number) => pedir('POST', `/torneios/${id}/calculo`);

describe('POST /torneios/:id/calculo', () => {
  it('setembro pronto: calcula, grava e devolve o resultado; o torneio fica calculado', async () => {
    const id = await setembroPronto();
    const { status, corpo } = await calcular(id);

    expect(status).toBe(200);
    expect(corpo).toMatchObject({ premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos', calculadoEm: expect.any(String) });
    expect(corpo.times.map((t: { time: string; premioCentavos: number }) => [t.time, t.premioCentavos])).toEqual([
      ['Lobos', 500_000], ['Corvos', 300_000], ['Falcões', 100_000], ['Tubarões', 100_000], ['Panteras', 0], ['Serpentes', 0],
    ]);
    expect(corpo.jogadores.find((j: { nick: string }) => j.nick === 'Tuca')).toMatchObject({ premioCentavos: 6_590, recebeuCentavo: true });
    // jogador de time sem prêmio também está no cálculo, com R$ 0
    expect(corpo.jogadores.find((j: { nick: string }) => j.nick === 'Kaio_BR')).toMatchObject({ time: 'Serpentes', posicao: 6, premioCentavos: 0 });

    const torneio = (await pedir('GET', `/torneios/${id}`)).corpo;
    expect(torneio).toMatchObject({ status: 'calculado', calculadoEm: corpo.calculadoEm });
    expect(torneio.calculo).toMatchObject({ calculado: true, podeCalcular: false, calculadoEm: corpo.calculadoEm });
  });

  it('não pode calcular: 409 com as contagens do que falta (conferido de novo, sem confiar na tela)', async () => {
    const id = await torneioCom(setembro());
    const { status, corpo } = await calcular(id);
    expect(status).toBe(409);
    expect(corpo).toMatchObject({ erro: 'Ainda não dá para calcular: 3 sem Ciente.', calculo: { podeCalcular: false, semCiente: 3, bloqueios: 0, aguardandoSite: 0 } });
    expect(await bd('calculos').where({ torneio_id: id })).toEqual([]);
    expect((await pedir('GET', `/torneios/${id}`)).corpo.status).not.toBe('calculado');
  });

  it('um Ciente desfeito logo antes: o cálculo recusa', async () => {
    const id = await setembroPronto();
    const [qualquer] = (await pedir('GET', `/torneios/${id}/pendencias`)).corpo.naoBloqueantes;
    await pedir('DELETE', `/torneios/${id}/pendencias/${qualquer.chave}/ciente`);

    const { status, corpo } = await calcular(id);
    expect(status).toBe(409);
    expect(corpo.calculo).toMatchObject({ semCiente: 1 });
  });

  it('partidas aguardando o site, bloqueio e sem planilha: 409 com cada motivo', async () => {
    const aguardando = await torneioCom(setembro(), { conferir: false });
    expect((await calcular(aguardando)).corpo).toMatchObject({ erro: 'Ainda não dá para calcular: 15 aguardando o site.', calculo: { aguardandoSite: 15 } });

    const bloqueio = await torneioCom(readFileSync(arquivo('testes/planilhas/02-id-inexistente.csv')));
    expect((await calcular(bloqueio)).corpo).toMatchObject({ erro: 'Ainda não dá para calcular: 1 bloqueio.', calculo: { bloqueios: 1 } });

    const { corpo: semPlanilha } = await pedir('POST', '/torneios', { nome: 'Sem planilha', premioCentavos: 1_000_000, percentuais: [100], modoDivisao: 'minutos' });
    const resposta = await calcular(semPlanilha.id);
    expect(resposta.status).toBe(409);
    expect(resposta.corpo).toMatchObject({ erro: 'Ainda não dá para calcular: envie a planilha.', calculo: { semPlanilha: true } });
  });

  it('já calculado: 409, e o resultado não muda', async () => {
    const id = await setembroPronto();
    const primeiro = (await calcular(id)).corpo;
    const { status, corpo } = await calcular(id);
    expect(status).toBe(409);
    expect(corpo.erro).toBe('O torneio já foi calculado.');
    const [calculo] = await bd('calculos').where({ torneio_id: id });
    expect(calculo.calculado_em.toISOString()).toBe(primeiro.calculadoEm);
  });

  it('dois cálculos ao mesmo tempo: um 200, um 409, e o resultado gravado uma vez', async () => {
    const id = await setembroPronto();
    const respostas = await Promise.all([calcular(id), calcular(id), calcular(id)]);
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409, 409]);

    expect(await bd('calculos').where({ torneio_id: id })).toHaveLength(1);
    const [{ id: calculoId }] = await bd('calculos').where({ torneio_id: id });
    expect(await bd('premios_time').where({ calculo_id: calculoId })).toHaveLength(6);
    expect(await bd('premios_jogador').where({ calculo_id: calculoId })).toHaveLength(31);
  });

  it('torneio que não existe: 404', async () => {
    expect((await calcular(999_999)).status).toBe(404);
  });
});

describe('depois do cálculo, nada muda (D1, D22)', () => {
  it('Ciente, desfazer, Ciente de todas, correção de ID, nova planilha e "tentar agora" respondem 409', async () => {
    const id = await setembroPronto();
    expect((await calcular(id)).status).toBe(200);
    const [pendencia] = (await pedir('GET', `/torneios/${id}/pendencias`)).corpo.naoBloqueantes;
    const partida = await bd('partidas').where({ torneio_id: id, id_partida: '#45659' }).first();

    const tentativas = await Promise.all([
      pedir('PUT', `/torneios/${id}/pendencias/${pendencia.chave}/ciente`),
      pedir('DELETE', `/torneios/${id}/pendencias/${pendencia.chave}/ciente`),
      pedir('POST', `/torneios/${id}/pendencias/ciente-de-todas`),
      pedir('PUT', `/torneios/${id}/partidas/${partida.id}/id-partida`, { idPartida: '#45695' }),
      pedir('PUT', `/torneios/${id}/planilha`, setembro()),
      pedir('POST', `/torneios/${id}/tentar-agora`),
    ]);
    expect(tentativas.map((t) => t.status)).toEqual([409, 409, 409, 409, 409, 409]);
    expect(tentativas.every((t) => /calculado/.test(t.corpo.erro))).toBe(true);
  });
});

describe('menos times do que posições premiadas (D24)', () => {
  it('2 times e 50/30/20: os 20% sem time são divididos igual: 1º R$ 6.000, 2º R$ 4.000', async () => {
    // só a partida #45659 de setembro: Lobos x Serpentes
    const [cabecalho, ...linhas] = setembro().toString('utf8').split('\r\n');
    const umaPartida = Buffer.from([cabecalho, ...linhas.filter((l) => l.includes(';#45659;'))].join('\r\n'), 'utf8');
    const id = await torneioCom(umaPartida);

    const { status, corpo } = await calcular(id);
    expect(status).toBe(200);
    expect(corpo.times.map((t: { time: string; premioCentavos: number }) => [t.time, t.premioCentavos])).toEqual([['Lobos', 600_000], ['Serpentes', 400_000]]);
    expect(corpo.jogadores.reduce((s: number, j: { premioCentavos: number }) => s + j.premioCentavos, 0)).toBe(1_000_000);
  });
});
