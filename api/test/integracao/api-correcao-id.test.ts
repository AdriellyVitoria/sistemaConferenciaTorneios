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
import { criarClienteSiteOficial, type SiteOficial } from '../../src/conferencia/site-oficial';
import { conectarAoBancoDeTeste, esvaziarTabelas, relogioDoBanco } from './banco-de-teste';
import { COM_SENHA, SENHA_DE_TESTE } from '../ajudantes/senha';

const RAIZ = path.resolve(__dirname, '../../..');
const arquivo = (relativo: string) => path.join(RAIZ, relativo);

function dadosDoSite() {
  const partidas = carregarPartidas([arquivo('testes/site-oficial.json'), arquivo('api/test/fixtures/site-setembro.json')]);
  const copia = (de: string, para: string) => structuredClone({ ...partidas.get(de)!, id: para });
  partidas.set('#46056', copia('#46065', '#46056'));
  const outroValor = copia('#46065', '#46057');
  outroValor.jogadores = outroValor.jogadores.map((j) => (j.nick === 'Pantera_X' ? { ...j, minutos: 40 } : j));
  partidas.set('#46057', outroValor);
  partidas.set('#48078', copia('#48087', '#48078'));
  return partidas;
}

let bd: Knex;
let relogio: () => Date;
let api: Server;
let site: Server;
let base: string;
let clienteDoSite: SiteOficial;

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
  site = criarSiteSimulado(dadosDoSite()).listen(0, '127.0.0.1');
  await new Promise((pronto) => site.once('listening', pronto));
  clienteDoSite = criarClienteSiteOficial({ urlBase: `http://127.0.0.1:${(site.address() as AddressInfo).port}`, tempoLimiteMs: 5_000 });
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

const rodada = (siteUsado: SiteOficial = clienteDoSite, agora = () => new Date(relogio().getTime() + 2_000)) =>
  executarRodada({ bd, site: siteUsado, agora, intervalosMs: [60_000], lote: 3, presaAposMs: 120_000 });

async function torneioConferido(planilha: string): Promise<number> {
  const { corpo } = await pedir('POST', '/torneios', { nome: planilha, premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
  expect((await pedir('PUT', `/torneios/${corpo.id}/planilha`, readFileSync(arquivo(planilha)))).status).toBe(200);
  await rodada();
  return corpo.id;
}

const partidaDoBanco = (torneioId: number, idPartida: string) => bd('partidas').where({ torneio_id: torneioId, id_partida: idPartida }).first();
const corrigir = (torneioId: number, partidaId: number, idPartida: unknown) =>
  pedir('PUT', `/torneios/${torneioId}/partidas/${partidaId}/id-partida`, { idPartida });
const pendencias = async (id: number) => (await pedir('GET', `/torneios/${id}/pendencias`)).corpo;

describe('PUT /torneios/:id/partidas/:partidaId/id-partida', () => {
  it('cenário 02: corrige #52214 para #52241, a partida volta para a fila e depois é conferida', async () => {
    const id = await torneioConferido('testes/planilhas/02-id-inexistente.csv');
    const errada = await partidaDoBanco(id, '#52214');
    expect(errada.status_conferencia).toBe('nao_encontrada');

    const { status, corpo } = await corrigir(id, errada.id, '#52241');
    expect(status).toBe(200);
    expect(corpo).toMatchObject({ id: errada.id, idPartida: '#52241', idPartidaPlanilha: '#52214', statusConferencia: 'aguardando', tentativas: 0 });
    expect((await pendencias(id)).resumo).toMatchObject({ bloqueantes: 0, aguardandoSite: 1 });

    await rodada();
    expect(await partidaDoBanco(id, '#52241')).toMatchObject({ status_conferencia: 'conferida' });
    expect((await pendencias(id)).resumo).toMatchObject({ bloqueantes: 0, naoBloqueantes: 0, aguardandoSite: 0 });
  });

  it('a planilha original não muda: as linhas continuam com o ID digitado', async () => {
    const id = await torneioConferido('testes/planilhas/02-id-inexistente.csv');
    const errada = await partidaDoBanco(id, '#52214');
    await corrigir(id, errada.id, '#52241');
    const ids = await bd('linhas_planilha').where({ partida_id: errada.id }).distinct('id_partida');
    expect(ids).toEqual([{ id_partida: '#52214' }]);
  });

  it('aceita o ID como a importação: sem "#" e com espaços em volta', async () => {
    const id = await torneioConferido('testes/planilhas/02-id-inexistente.csv');
    const errada = await partidaDoBanco(id, '#52214');
    expect((await corrigir(id, errada.id, '  52241 ')).corpo.idPartida).toBe('#52241');
  });

  it('corrigir de novo: o ID original continua sendo o da planilha', async () => {
    const id = await torneioConferido('testes/planilhas/02-id-inexistente.csv');
    const errada = await partidaDoBanco(id, '#52214');
    await corrigir(id, errada.id, '#99999');
    const { corpo } = await corrigir(id, errada.id, '#52241');
    expect(corpo).toMatchObject({ idPartida: '#52241', idPartidaPlanilha: '#52214' });
  });

  it('começa do zero com o site: tentativas zeradas, sem erro, sem vencedor e sem as participações do ID antigo', async () => {
    const id = await torneioConferido('torneio-setembro.csv');
    const p = await partidaDoBanco(id, '#45659');
    await bd('partidas').where({ id: p.id }).update({ tentativas: 3, ultimo_erro: 'x', origem_do_erro: 'site' });

    await corrigir(id, p.id, '#45695');
    const corrigida = await bd('partidas').where({ id: p.id }).first();
    expect(corrigida).toMatchObject({
      id_partida: '#45695', status_conferencia: 'aguardando', tentativas: 0, vencedor: null,
      ultimo_erro: null, origem_do_erro: null, ultima_tentativa_em: null, em_consulta_desde: null,
    });
    expect(corrigida.proxima_tentativa_em.getTime()).toBeLessThanOrEqual(relogio().getTime());
    expect(await bd('participacoes').where({ partida_id: p.id })).toEqual([]);
  });

  it('ID que já é de outra partida do torneio: 409, e nada muda (juntar daria 4 times, D23)', async () => {
    const id = await torneioConferido('testes/planilhas/02-id-inexistente.csv');
    const errada = await partidaDoBanco(id, '#52214');
    const { status, corpo } = await corrigir(id, errada.id, '52011');
    expect(status).toBe(409);
    expect(corpo.erro).toBe('O ID #52011 já é de outra partida deste torneio. Confira o ID: cada partida tem o seu.');
    expect(await bd('partidas').where({ id: errada.id }).first()).toMatchObject({ id_partida: '#52214', status_conferencia: 'nao_encontrada' });
  });

  it.each([
    ['#52a41', 'O ID da partida precisa ter só números, como #45659. Veio "#52a41".'],
    ['', 'O ID da partida está vazio.'],
    ['   ', 'O ID da partida está vazio.'],
  ])('formato inválido "%s": 400 com a mesma frase da importação', async (texto, mensagem) => {
    const id = await torneioConferido('testes/planilhas/02-id-inexistente.csv');
    const errada = await partidaDoBanco(id, '#52214');
    const { status, corpo } = await corrigir(id, errada.id, texto);
    expect(status).toBe(400);
    expect(corpo.erro).toBe(mensagem);
  });

  it('sem o campo, ou com outro tipo: 400', async () => {
    const id = await torneioConferido('testes/planilhas/02-id-inexistente.csv');
    const errada = await partidaDoBanco(id, '#52214');
    expect((await pedir('PUT', `/torneios/${id}/partidas/${errada.id}/id-partida`, {})).status).toBe(400);
    expect((await corrigir(id, errada.id, 52241)).status).toBe(400);
  });

  it('o mesmo ID que já está: 400, não há o que corrigir', async () => {
    const id = await torneioConferido('testes/planilhas/02-id-inexistente.csv');
    const errada = await partidaDoBanco(id, '#52214');
    const { status, corpo } = await corrigir(id, errada.id, '#52214');
    expect(status).toBe(400);
    expect(corpo.erro).toBe('Esse já é o ID da partida.');
  });

  it('depois do cálculo: 409', async () => {
    const id = await torneioConferido('testes/planilhas/02-id-inexistente.csv');
    const errada = await partidaDoBanco(id, '#52214');
    await bd('torneios').where({ id }).update({ status: 'calculado', calculado_em: new Date() });
    const { status, corpo } = await corrigir(id, errada.id, '#52241');
    expect(status).toBe(409);
    expect(corpo.erro).toContain('calculado');
  });

  it('torneio ou partida que não existe, ou partida de outro torneio: 404', async () => {
    const id = await torneioConferido('testes/planilhas/02-id-inexistente.csv');
    const outro = await torneioConferido('testes/planilhas/02-id-inexistente.csv');
    const deOutroTorneio = await partidaDoBanco(outro, '#52214');
    expect((await corrigir(999_999, deOutroTorneio.id, '#52241')).status).toBe(404);
    expect((await corrigir(id, 999_999, '#52241')).status).toBe(404);
    expect((await corrigir(id, deOutroTorneio.id, '#52241')).status).toBe(404);
  });
});

describe('correção durante a consulta: o recibo do 4b descarta o resultado do ID antigo', () => {
  it('a consulta do ID antigo termina depois da correção e não grava nada', async () => {
    const { corpo: criado } = await pedir('POST', '/torneios', { nome: 'x', premioCentavos: 1_000_000, percentuais: [100], modoDivisao: 'minutos' });
    const id = criado.id;
    await pedir('PUT', `/torneios/${id}/planilha`, readFileSync(arquivo('torneio-setembro.csv')));
    const alvo = await partidaDoBanco(id, '#45659');
    await bd('partidas').where({ torneio_id: id }).whereNot({ id: alvo.id }).update({ status_conferencia: 'conferida', proxima_tentativa_em: null });
    await bd('partidas').where({ id: alvo.id }).update({ proxima_tentativa_em: new Date(relogio().getTime() - 60_000) });
    const inicioDaRodada = new Date(relogio().getTime() - 30_000);

    let soltar!: () => void;
    const consultaPresa = new Promise<void>((pronto) => { soltar = pronto; });
    let comecou!: () => void;
    const consultaComecou = new Promise<void>((pronto) => { comecou = pronto; });
    const lento: SiteOficial = {
      async consultarPartida(idPartida) {
        comecou();
        await consultaPresa;
        return clienteDoSite.consultarPartida(idPartida);
      },
    };
    const emAndamento = rodada(lento, () => inicioDaRodada);
    await consultaComecou;
    expect((await partidaDoBanco(id, '#45659')).status_conferencia).toBe('em_consulta');

    expect((await corrigir(id, alvo.id, '#45695')).status).toBe(200);
    soltar();

    expect(await emAndamento).toMatchObject({ consultadas: 1, conferidas: 0, descartadas: 1 });
    expect(await bd('partidas').where({ id: alvo.id }).first()).toMatchObject({ id_partida: '#45695', status_conferencia: 'aguardando', vencedor: null });
    expect(await bd('participacoes').where({ partida_id: alvo.id })).toEqual([]);
  });
});

describe('os Cientes depois da correção do ID', () => {
  it('a duplicata vem da planilha: o Ciente continua depois de corrigir o ID (o site mostra o mesmo valor)', async () => {
    const id = await torneioConferido('torneio-setembro.csv');
    const duplicata = (await pendencias(id)).naoBloqueantes.find((p: { tipo: string }) => p.tipo === 'duplicata');
    await pedir('PUT', `/torneios/${id}/pendencias/${duplicata.chave}/ciente`);

    const partida = await partidaDoBanco(id, '#46065');
    expect((await corrigir(id, partida.id, '#46056')).status).toBe(200);
    await rodada();

    const depois = (await pendencias(id)).naoBloqueantes.find((p: { tipo: string }) => p.tipo === 'duplicata');
    expect(depois).toMatchObject({ idPartida: '#46056', nick: 'Pantera_X', ciente: true, chave: duplicata.chave });
  });

  it('a duplicata pede Ciente de novo se o site do ID novo mostrar outro valor para o jogador', async () => {
    const id = await torneioConferido('torneio-setembro.csv');
    await pedir('POST', `/torneios/${id}/pendencias/ciente-de-todas`);
    const partida = await partidaDoBanco(id, '#46065');
    await corrigir(id, partida.id, '#46057');
    await rodada();

    const depois = (await pendencias(id)).naoBloqueantes.find((p: { tipo: string }) => p.tipo === 'duplicata');
    expect(depois).toMatchObject({ idPartida: '#46057', valorSite: '40 min, 8 kills', ciente: false });
  });

  it('pendência que vem do site, na partida corrigida, volta sem Ciente; as das outras partidas continuam', async () => {
    const id = await torneioConferido('torneio-setembro.csv');
    expect((await pedir('POST', `/torneios/${id}/pendencias/ciente-de-todas`)).corpo).toEqual({ marcadas: 3 });

    const partida = await partidaDoBanco(id, '#48087');
    await corrigir(id, partida.id, '#48078');
    await rodada();

    const lista = (await pendencias(id)).naoBloqueantes;
    expect(lista.find((p: { tipo: string }) => p.tipo === 'nick_diferente')).toMatchObject({ idPartida: '#48078', valorPlanilha: 'xxsniperxx', valorSite: 'xXSniperXx', ciente: false });
    expect(lista.find((p: { tipo: string }) => p.tipo === 'duplicata').ciente).toBe(true);
    expect(lista.find((p: { tipo: string }) => p.tipo === 'sem_dados_planilha').ciente).toBe(true);
  });
});
