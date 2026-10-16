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
import { COM_SENHA, SENHA_DE_TESTE } from '../ajudantes/senha';

const RAIZ = path.resolve(__dirname, '../../..');
const arquivo = (relativo: string) => path.join(RAIZ, relativo);
const DADOS_DO_SITE = [arquivo('testes/site-oficial.json'), arquivo('api/test/fixtures/site-setembro.json')];

let bd: Knex;
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
  return { status: resposta.status, corpo: await resposta.json() };
}

async function torneioCom(planilha: string, { conferir = true } = {}): Promise<number> {
  const { corpo } = await pedir('POST', '/torneios', { nome: planilha, premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
  expect((await pedir('PUT', `/torneios/${corpo.id}/planilha`, readFileSync(arquivo(planilha)))).status).toBe(200);
  if (conferir) await conferirTudo();
  return corpo.id;
}

async function conferirTudo() {
  const clienteDoSite = criarClienteSiteOficial({ urlBase: urlDoSite, tempoLimiteMs: 5_000 });
  await executarRodada({ bd, site: clienteDoSite, agora: () => new Date(relogio().getTime() + 2_000), intervalosMs: [60_000], lote: 3, presaAposMs: 120_000 });
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

  const quantosCientes = async (id: number) => Number((await bd('cientes').where({ torneio_id: id }).count({ n: '*' }))[0].n);

  it('com partida aguardando o site ou em consulta: 409, sem marcar nenhuma', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    await bd('partidas').where({ torneio_id: id, id_partida: '#45659' }).update({ status_conferencia: 'aguardando' });
    await bd('partidas').where({ torneio_id: id, id_partida: '#46903' }).update({ status_conferencia: 'em_consulta', em_consulta_desde: new Date() });

    const { status, corpo } = await cienteDeTodas(id);
    expect(status).toBe(409);
    expect(corpo.erro).toBe('2 partidas ainda aguardam o site: o "Ciente de todas" só libera depois que o site conferir todas. Enquanto isso, dê Ciente uma a uma.');
    expect(await quantosCientes(id)).toBe(0);
  });

  it('com partida aguardando o site, o Ciente de uma pendência continua liberado', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    await bd('partidas').where({ torneio_id: id, id_partida: '#45659' }).update({ status_conferencia: 'aguardando' });
    const [duplicata] = (await pendencias(id)).corpo.naoBloqueantes;
    expect((await ciente(id, duplicata.chave)).status).toBe(200);
  });

  it('antes de o site responder qualquer partida: 409 com a contagem', async () => {
    const id = await torneioCom('torneio-setembro.csv', { conferir: false });
    expect((await cienteDeTodas(id)).corpo.erro).toMatch(/^15 partidas ainda aguardam o site/);
  });

  it('a verificação é feita dentro da transação, com o torneio travado', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const trx = await bd.transaction();
    await trx('torneios').where({ id }).forUpdate().first();
    const pedido = cienteDeTodas(id);
    await new Promise((pronto) => setTimeout(pronto, 300));
    await trx('partidas').where({ torneio_id: id, id_partida: '#45659' }).update({ status_conferencia: 'aguardando' });
    await trx.commit();

    expect((await pedido).status).toBe(409);
    expect(await quantosCientes(id)).toBe(0);
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

describe('GET /torneios/:id: kills de cada time segundo o site (5f)', () => {
  const SITE_SETEMBRO: Record<string, { jogadores: { time: string; kills: number }[] }> = JSON.parse(readFileSync(DADOS_DO_SITE[1], 'utf8'));
  const killsDoSite = (idPartida: string, time: string) =>
    SITE_SETEMBRO[idPartida].jogadores.filter((j) => j.time === time).reduce((total, j) => total + j.kills, 0);

  it('cada partida conferida traz as kills do time A e do time B (na ordem da planilha), somadas do site', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const { corpo } = await pedir('GET', `/torneios/${id}`);
    const porId = new Map(corpo.partidas.map((p: { idPartida: string }) => [p.idPartida, p]));

    expect(porId.get('#40923')).toMatchObject({ timeA: 'Falcões', timeB: 'Panteras', killsSite: { timeA: 62, timeB: 45 } });
    for (const p of corpo.partidas as { idPartida: string; timeA: string; timeB: string; killsSite: unknown }[]) {
      expect(p.killsSite).toEqual({ timeA: killsDoSite(p.idPartida, p.timeA), timeB: killsDoSite(p.idPartida, p.timeB) });
    }
  });

  it('partida que o site ainda não respondeu: sem kills (null)', async () => {
    const id = await torneioCom('torneio-setembro.csv', { conferir: false });
    const { corpo } = await pedir('GET', `/torneios/${id}`);
    expect(corpo.partidas.every((p: { killsSite: unknown }) => p.killsSite === null)).toBe(true);
  });
});

describe('GET /torneios/:id: pronto para calcular (5c)', () => {
  const calculo = async (id: number) => (await pedir('GET', `/torneios/${id}`)).corpo.calculo;

  it('setembro: aguardando o site, depois sem os Cientes, e só com os 3 Cientes pode calcular', async () => {
    const id = await torneioCom('torneio-setembro.csv', { conferir: false });
    expect(await calculo(id)).toEqual({
      podeCalcular: false, calculado: false, calculadoEm: null, semPlanilha: false, aguardandoSite: 15, bloqueios: 0, semCiente: 0,
    });

    await conferirTudo();
    expect(await calculo(id)).toMatchObject({ podeCalcular: false, aguardandoSite: 0, bloqueios: 0, semCiente: 3 });

    const [duplicata, nick] = (await pendencias(id)).corpo.naoBloqueantes;
    await ciente(id, duplicata.chave);
    await ciente(id, nick.chave);
    expect(await calculo(id)).toMatchObject({ podeCalcular: false, semCiente: 1 });

    expect((await cienteDeTodas(id)).corpo).toEqual({ marcadas: 1 });
    expect(await calculo(id)).toEqual({
      podeCalcular: true, calculado: false, calculadoEm: null, semPlanilha: false, aguardandoSite: 0, bloqueios: 0, semCiente: 0,
    });

    await desfazer(id, nick.chave);
    expect(await calculo(id)).toMatchObject({ podeCalcular: false, semCiente: 1 });
  });

  it('cenário 02: o ID que o site não conhece bloqueia; corrigido e conferido, pode', async () => {
    const id = await torneioCom('testes/planilhas/02-id-inexistente.csv');
    expect(await calculo(id)).toMatchObject({ podeCalcular: false, bloqueios: 1, semCiente: 0, aguardandoSite: 0 });

    const errada = await bd('partidas').where({ torneio_id: id, id_partida: '#52214' }).first();
    await pedir('PUT', `/torneios/${id}/partidas/${errada.id}/id-partida`, { idPartida: '#52241' });
    expect(await calculo(id)).toMatchObject({ podeCalcular: false, bloqueios: 0, aguardandoSite: 1 });

    await conferirTudo();
    expect(await calculo(id)).toMatchObject({ podeCalcular: true, bloqueios: 0, aguardandoSite: 0, semCiente: 0 });
  });

  it('em consulta conta como aguardando o site', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    await cienteDeTodas(id);
    await bd('partidas').where({ torneio_id: id, id_partida: '#45659' }).update({ status_conferencia: 'em_consulta', em_consulta_desde: new Date() });
    expect(await calculo(id)).toMatchObject({ podeCalcular: false, aguardandoSite: 1 });
  });

  it('torneio sem planilha: não pode', async () => {
    const { corpo } = await pedir('POST', '/torneios', { nome: 'Sem planilha', premioCentavos: 1_000_000, percentuais: [100], modoDivisao: 'minutos' });
    expect(await calculo(corpo.id)).toMatchObject({ podeCalcular: false, semPlanilha: true, aguardandoSite: 0, bloqueios: 0, semCiente: 0 });
  });

  it('depois do cálculo: informa que já foi calculado', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    await cienteDeTodas(id);
    await bd('torneios').where({ id }).update({ status: 'calculado', calculado_em: new Date('2026-10-15T13:00:00.000Z') });
    expect(await calculo(id)).toMatchObject({ podeCalcular: false, calculado: true, calculadoEm: '2026-10-15T13:00:00.000Z' });
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
