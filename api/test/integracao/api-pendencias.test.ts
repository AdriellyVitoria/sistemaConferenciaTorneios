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

/** Cria o torneio e importa a planilha; com `conferir`, roda o job até o site responder tudo. */
async function torneioCom(planilha: string, { conferir = true } = {}): Promise<number> {
  const { corpo } = await pedir('POST', '/torneios', { nome: planilha, premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
  expect((await pedir('PUT', `/torneios/${corpo.id}/planilha`, readFileSync(arquivo(planilha)))).status).toBe(200);
  if (conferir) await conferirTudo();
  return corpo.id;
}

async function conferirTudo() {
  const clienteDoSite = criarClienteSiteOficial({ urlBase: urlDoSite, tempoLimiteMs: 5_000 });
  await executarRodada({ bd, site: clienteDoSite, agora: () => new Date(Date.now() + 2_000), intervalosMs: [60_000], lote: 3, presaAposMs: 120_000 });
}

const pendencias = (id: number) => pedir('GET', `/torneios/${id}/pendencias`);
const ciente = (id: number, chave: string) => pedir('PUT', `/torneios/${id}/pendencias/${chave}/ciente`);
const desfazer = (id: number, chave: string) => pedir('DELETE', `/torneios/${id}/pendencias/${chave}/ciente`);
const cienteDeTodas = (id: number) => pedir('POST', `/torneios/${id}/pendencias/ciente-de-todas`);

describe('GET /torneios/:id/pendencias', () => {
  it('setembro: exatamente as três pendências do contexto.md, todas não bloqueantes e sem Ciente', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const { status, corpo } = await pendencias(id);

    expect(status).toBe(200);
    expect(corpo.bloqueantes).toEqual([]);
    expect(corpo.naoBloqueantes).toEqual([
      expect.objectContaining({
        tipo: 'duplicata', idPartida: '#46065', nick: 'Pantera_X',
        valorPlanilha: '2 vezes: 42 min, 8 kills / 42 min, 8 kills', valorSite: '42 min, 8 kills', ciente: false, cienteEm: null,
      }),
      expect.objectContaining({ tipo: 'nick_diferente', idPartida: '#48087', nick: 'xXSniperXx', valorPlanilha: 'xxsniperxx', valorSite: 'xXSniperXx', ciente: false }),
      expect.objectContaining({ tipo: 'sem_dados_planilha', idPartida: '#40923', valorPlanilha: 'sem dados', valorSite: 'Falcões venceu', ciente: false }),
    ]);
    expect(corpo.naoBloqueantes[0].mensagem).toContain('linhas 38 e 39');
    expect(corpo.naoBloqueantes.every((p: { chave: string }) => /^[0-9a-f]{64}$/.test(p.chave))).toBe(true);
    expect(corpo.resumo).toEqual({ bloqueantes: 0, naoBloqueantes: 3, comCiente: 0, semCiente: 3, aguardandoSite: 0 });
  });

  it('antes de o site responder, não há pendência: as partidas estão aguardando o site', async () => {
    const id = await torneioCom('torneio-setembro.csv', { conferir: false });
    const { corpo } = await pendencias(id);
    expect(corpo).toMatchObject({ bloqueantes: [], naoBloqueantes: [], resumo: { aguardandoSite: 15 } });
  });

  it('cenário 02: o ID que o site não conhece é bloqueante', async () => {
    const id = await torneioCom('testes/planilhas/02-id-inexistente.csv');
    const { corpo } = await pendencias(id);
    expect(corpo.bloqueantes).toEqual([expect.objectContaining({ tipo: 'nao_encontrada', idPartida: '#52214', ciente: false })]);
    expect(corpo.naoBloqueantes).toEqual([]);
  });

  it('times diferentes (os times vêm das participações do site) é bloqueante, e só ele aparece da partida', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    // como se o site tivesse registrado, para o #45659, uma partida entre outros times
    const partida = await bd('partidas').where({ torneio_id: id, id_partida: '#45659' }).first();
    await bd('participacoes').where({ partida_id: partida.id, time: 'Lobos' }).update({ time: 'Corvos' });
    await bd('participacoes').where({ partida_id: partida.id, time: 'Serpentes' }).update({ time: 'Panteras' });

    const { corpo } = await pendencias(id);
    expect(corpo.bloqueantes).toEqual([
      expect.objectContaining({ tipo: 'times_diferentes', idPartida: '#45659', valorPlanilha: 'Lobos x Serpentes', valorSite: 'Corvos x Panteras' }),
    ]);
    expect(corpo.naoBloqueantes.some((p: { idPartida: string }) => p.idPartida === '#45659')).toBe(false);
  });

  it('torneio que não existe: 404', async () => {
    expect((await pendencias(999_999)).status).toBe(404);
  });
});

describe('Ciente', () => {
  it('marca uma pendência não bloqueante, e só ela', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const [duplicata] = (await pendencias(id)).corpo.naoBloqueantes;

    const { status, corpo } = await ciente(id, duplicata.chave);
    expect(status).toBe(200);
    expect(corpo).toEqual({ chave: duplicata.chave, ciente: true });

    const depois = (await pendencias(id)).corpo;
    expect(depois.naoBloqueantes.map((p: { ciente: boolean }) => p.ciente)).toEqual([true, false, false]);
    expect(depois.naoBloqueantes[0].cienteEm).toEqual(expect.any(String));
    expect(depois.resumo).toMatchObject({ comCiente: 1, semCiente: 2 });
  });

  it('marcar de novo não duplica nem muda a hora do primeiro Ciente', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const [duplicata] = (await pendencias(id)).corpo.naoBloqueantes;
    await ciente(id, duplicata.chave);
    const primeiro = (await pendencias(id)).corpo.naoBloqueantes[0].cienteEm;
    await new Promise((pronto) => setTimeout(pronto, 20));

    expect((await ciente(id, duplicata.chave)).status).toBe(200);
    expect((await pendencias(id)).corpo.naoBloqueantes[0].cienteEm).toBe(primeiro);
    const [{ n }] = await bd('cientes').where({ torneio_id: id }).count({ n: '*' });
    expect(Number(n)).toBe(1);
  });

  it('a Maria pode desfazer o Ciente', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const [duplicata] = (await pendencias(id)).corpo.naoBloqueantes;
    await ciente(id, duplicata.chave);

    const { status, corpo } = await desfazer(id, duplicata.chave);
    expect(status).toBe(200);
    expect(corpo).toEqual({ chave: duplicata.chave, ciente: false });
    expect((await pendencias(id)).corpo.naoBloqueantes[0]).toMatchObject({ ciente: false, cienteEm: null });
    // desfazer o que já não tem Ciente não é erro
    expect((await desfazer(id, duplicata.chave)).status).toBe(200);
  });

  it('bloqueante não aceita Ciente: 409, porque se resolve corrigindo o ID', async () => {
    const id = await torneioCom('testes/planilhas/02-id-inexistente.csv');
    const [naoEncontrada] = (await pendencias(id)).corpo.bloqueantes;

    const { status, corpo } = await ciente(id, naoEncontrada.chave);
    expect(status).toBe(409);
    expect(corpo.erro).toBe('Esta pendência não aceita Ciente: ela se resolve corrigindo o ID da partida.');
    expect((await desfazer(id, naoEncontrada.chave)).status).toBe(409);
    expect((await pendencias(id)).corpo.bloqueantes[0].ciente).toBe(false);
  });

  it('chave que não é de nenhuma pendência atual: 404', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const { status, corpo } = await ciente(id, 'f'.repeat(64));
    expect(status).toBe(404);
    expect(corpo.erro).toContain('não existe mais');
  });

  it('se um valor muda, a chave muda e o Ciente antigo não vale para a pendência nova', async () => {
    const id = await torneioCom('testes/planilhas/03-divergencias.csv');
    const antes = (await pendencias(id)).corpo.naoBloqueantes;
    const juba = antes.find((p: { nick: string }) => p.nick === 'Juba');
    expect(juba).toMatchObject({ tipo: 'divergencia', campo: 'kills', valorPlanilha: '18', valorSite: '8' });
    await ciente(id, juba.chave);

    // o site passa a registrar outro valor para Juba (por exemplo, depois de uma correção de ID)
    const partida = await bd('partidas').where({ torneio_id: id, id_partida: '#53132' }).first();
    await bd('participacoes').where({ partida_id: partida.id, nick: 'Juba' }).update({ kills: 9 });

    const depois = (await pendencias(id)).corpo.naoBloqueantes.find((p: { nick: string }) => p.nick === 'Juba');
    expect(depois).toMatchObject({ valorSite: '9', ciente: false });
    expect(depois.chave).not.toBe(juba.chave);
    expect((await ciente(id, juba.chave)).status).toBe(404);
  });

  it('cenário 03: as três divergências lado a lado, cada uma com o seu Ciente', async () => {
    const id = await torneioCom('testes/planilhas/03-divergencias.csv');
    const { corpo } = await pendencias(id);
    expect(corpo.naoBloqueantes.map((p: { nick: string; campo: string; valorPlanilha: string; valorSite: string }) => [p.nick, p.campo, p.valorPlanilha, p.valorSite])).toEqual([
      ['Juba', 'kills', '18', '8'],
      ['Plumada', 'minutos', '15', '27'],
      ['Harpia', 'kills', '9', '13'],
    ]);
  });
});

describe('Ciente de todas', () => {
  it('marca as não bloqueantes sem Ciente e diz quantas marcou', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const [duplicata] = (await pendencias(id)).corpo.naoBloqueantes;
    await ciente(id, duplicata.chave);

    expect(await cienteDeTodas(id)).toEqual({ status: 200, corpo: { marcadas: 2 } });
    expect((await pendencias(id)).corpo.resumo).toMatchObject({ comCiente: 3, semCiente: 0 });
    expect(await cienteDeTodas(id)).toEqual({ status: 200, corpo: { marcadas: 0 } });
  });

  it('não toca nas bloqueantes', async () => {
    const id = await torneioCom('testes/planilhas/02-id-inexistente.csv');
    expect((await cienteDeTodas(id)).corpo).toEqual({ marcadas: 0 });
    expect((await pendencias(id)).corpo.bloqueantes[0].ciente).toBe(false);
  });
});

describe('depois do cálculo, nada muda', () => {
  it('Ciente, desfazer e Ciente de todas respondem 409; a lista continua disponível', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const [duplicata, nick] = (await pendencias(id)).corpo.naoBloqueantes;
    await ciente(id, duplicata.chave);
    await bd('torneios').where({ id }).update({ status: 'calculado', calculado_em: new Date() });

    for (const resposta of [await ciente(id, nick.chave), await desfazer(id, duplicata.chave), await cienteDeTodas(id)]) {
      expect(resposta.status).toBe(409);
      expect(resposta.corpo.erro).toContain('calculado');
    }
    expect((await pendencias(id)).status).toBe(200);
    expect((await pendencias(id)).corpo.resumo).toMatchObject({ comCiente: 1, semCiente: 2 });
  });
});

describe('planilha enviada de novo (D22)', () => {
  it('a conferência recomeça do zero, e os Cientes também', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    await cienteDeTodas(id);

    expect((await pedir('PUT', `/torneios/${id}/planilha`, readFileSync(arquivo('torneio-setembro.csv')))).status).toBe(200);
    await conferirTudo();

    const { corpo } = await pendencias(id);
    expect(corpo.naoBloqueantes).toHaveLength(3);
    expect(corpo.resumo).toMatchObject({ comCiente: 0, semCiente: 3 });
    const [{ n }] = await bd('cientes').where({ torneio_id: id }).count({ n: '*' });
    expect(Number(n)).toBe(0);
  });
});
