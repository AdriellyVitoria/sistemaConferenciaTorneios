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

const RAIZ = path.resolve(__dirname, '../../..');
const arquivo = (relativo: string) => path.join(RAIZ, relativo);
const DADOS_DO_SITE = [arquivo('testes/site-oficial.json'), arquivo('api/test/fixtures/site-setembro.json')];

let bd: Knex;
/** O relógio do MySQL: a API e o job usam o mesmo relógio que grava a próxima tentativa na importação. */
let relogio: () => Date;
let api: Server;
let site: Server;
let base: string;
let clienteDoSite: SiteOficial;

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
  clienteDoSite = criarClienteSiteOficial({ urlBase: `http://127.0.0.1:${(site.address() as AddressInfo).port}`, tempoLimiteMs: 5_000 });
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
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

const rodada = (siteUsado: SiteOficial = clienteDoSite) =>
  executarRodada({ bd, site: siteUsado, agora: () => new Date(relogio().getTime() + 2_000), intervalosMs: [60_000], lote: 3, presaAposMs: 120_000 });

/** Setembro importado; com `conferir`, conferido e com os 3 Cientes. */
async function setembro({ nome = 'Torneio de setembro', conferir = true } = {}): Promise<number> {
  const { corpo } = await pedir('POST', '/torneios', { nome, premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
  expect((await pedir('PUT', `/torneios/${corpo.id}/planilha`, readFileSync(arquivo('torneio-setembro.csv')))).status).toBe(200);
  if (conferir) {
    await rodada();
    expect((await pedir('POST', `/torneios/${corpo.id}/pendencias/ciente-de-todas`)).corpo).toEqual({ marcadas: 3 });
  }
  return corpo.id;
}

/** Quanto sobrou do torneio em cada tabela. */
async function oQueSobrou(id: number) {
  const partidaIds = (await bd('partidas').where({ torneio_id: id }).select('id')).map((p: { id: number }) => p.id);
  const contar = async (consulta: Knex.QueryBuilder) => Number((await consulta.count({ n: '*' }).first())!.n);
  return {
    torneio: await contar(bd('torneios').where({ id })),
    partidas: partidaIds.length,
    linhas: await contar(bd('linhas_planilha').where({ torneio_id: id })),
    participacoes: await contar(bd('participacoes').join('partidas', 'partidas.id', 'participacoes.partida_id').where('partidas.torneio_id', id)),
    cientes: await contar(bd('cientes').where({ torneio_id: id })),
  };
}
const NADA = { torneio: 0, partidas: 0, linhas: 0, participacoes: 0, cientes: 0 };

describe('DELETE /torneios/:id', () => {
  it('antes do cálculo: remove o torneio e tudo dele (partidas, linhas, participações e Cientes); os outros ficam', async () => {
    const id = await setembro();
    const outro = await setembro({ nome: 'Outro torneio' });
    const antes = await oQueSobrou(id);
    expect(antes).toEqual({ torneio: 1, partidas: 15, linhas: 152, participacoes: expect.any(Number), cientes: 3 });
    expect(antes.participacoes).toBeGreaterThan(0);

    const { status, corpo } = await pedir('DELETE', `/torneios/${id}`);
    expect(status).toBe(204);
    expect(corpo).toBeNull();

    expect(await oQueSobrou(id)).toEqual(NADA);
    expect((await pedir('GET', `/torneios/${id}`)).status).toBe(404);
    expect((await pedir('GET', '/torneios')).corpo.map((t: { id: number }) => t.id)).toEqual([outro]);
    expect(await oQueSobrou(outro)).toMatchObject({ torneio: 1, partidas: 15, linhas: 152, cientes: 3 });
  });

  it('sem planilha: remove também', async () => {
    const { corpo } = await pedir('POST', '/torneios', { nome: 'Criado por engano', premioCentavos: 100, percentuais: [100], modoDivisao: 'minutos' });
    expect((await pedir('DELETE', `/torneios/${corpo.id}`)).status).toBe(204);
    expect(await oQueSobrou(corpo.id)).toEqual(NADA);
  });

  it('depois do cálculo: 409, e nada é apagado (o resultado é o registro do pagamento)', async () => {
    const id = await setembro();
    expect((await pedir('POST', `/torneios/${id}/calculo`)).status).toBe(200);

    const { status, corpo } = await pedir('DELETE', `/torneios/${id}`);
    expect(status).toBe(409);
    expect(corpo).toEqual({ erro: 'Torneio calculado não pode ser removido: o resultado é o registro do pagamento.' });
    expect(await oQueSobrou(id)).toMatchObject({ torneio: 1, partidas: 15, linhas: 152, cientes: 3 });
    expect(await bd('calculos').where({ torneio_id: id })).toHaveLength(1);
  });

  it('inexistente ou id inválido: 404', async () => {
    expect((await pedir('DELETE', '/torneios/999999')).status).toBe(404);
    expect((await pedir('DELETE', '/torneios/abc')).status).toBe(404);
  });

  it('dois pedidos ao mesmo tempo: um remove (204), o outro encontra o torneio já removido (404)', async () => {
    const id = await setembro();
    const respostas = await Promise.all([pedir('DELETE', `/torneios/${id}`), pedir('DELETE', `/torneios/${id}`)]);
    expect(respostas.map((r) => r.status).sort()).toEqual([204, 404]);
    expect(await oQueSobrou(id)).toEqual(NADA);
  });

  it('remover e calcular ao mesmo tempo: um espera o outro, e nunca fica um cálculo sem torneio', async () => {
    const id = await setembro();
    const [remocao, calculo] = await Promise.all([pedir('DELETE', `/torneios/${id}`), pedir('POST', `/torneios/${id}/calculo`)]);
    // ou removeu primeiro (o cálculo não encontra o torneio), ou calculou primeiro (a remoção é recusada)
    expect(['204 404', '409 200']).toContain(`${remocao.status} ${calculo.status}`);
    const sobrou = await oQueSobrou(id);
    if (remocao.status === 204) expect(sobrou).toEqual(NADA);
    else expect(await bd('calculos').where({ torneio_id: id })).toHaveLength(1);
  });
});

describe('remoção durante a consulta do job', () => {
  it('o site responde depois da remoção: o recibo descarta o resultado, sem erro, e nada é gravado', async () => {
    const id = await setembro({ conferir: false });

    // o site demora na consulta da #40923: enquanto isso, a Maria remove o torneio
    let removeu = false;
    const lento: SiteOficial = {
      async consultarPartida(idPartida) {
        if (idPartida === '#40923' && !removeu) {
          removeu = true;
          expect((await pedir('DELETE', `/torneios/${id}`)).status).toBe(204);
        }
        return clienteDoSite.consultarPartida(idPartida);
      },
    };
    const resumo = await rodada(lento);

    expect(removeu).toBe(true);
    expect(resumo.descartadas).toBeGreaterThanOrEqual(1);
    expect(resumo.erros).toBe(0);
    expect(await oQueSobrou(id)).toEqual(NADA);
    // nenhuma participação de setembro foi gravada depois da remoção
    expect(await bd('participacoes')).toEqual([]);
  });
});
