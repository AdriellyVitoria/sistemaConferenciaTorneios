import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarApp as criarSiteSimulado } from '../../../site-oficial-simulado/src/app';
import { carregarPartidas } from '../../../site-oficial-simulado/src/dados';
import { executarRodada } from '../../src/conferencia/job';
import { criarClienteSiteOficial } from '../../src/conferencia/site-oficial';
import { consultarTorneio, criarTorneio, importarPlanilha } from '../../src/servicos/torneios';
import { conectarAoBancoDeTeste, esvaziarTabelas, horaDoBanco } from './banco-de-teste';

/**
 * Code review, item 3, de ponta a ponta: o site responde a #48450 (Lobos x Corvos) com o vencedor
 * "lobos". Antes, a partida era conferida e o cálculo quebrava com um time fantasma. Agora ela fica
 * "aguardando o site", com o motivo, e é tentada de novo; as outras 14 são conferidas.
 */

const RAIZ = path.resolve(__dirname, '../../..');
const arquivo = (relativo: string) => path.join(RAIZ, relativo);

let bd: Knex;
let site: Server;
let urlDoSite: string;

beforeAll(() => { bd = conectarAoBancoDeTeste(); });
afterAll(() => bd.destroy());
beforeEach(async () => {
  await esvaziarTabelas(bd);
  const partidas = carregarPartidas([arquivo('testes/site-oficial.json'), arquivo('api/test/fixtures/site-setembro.json')]);
  partidas.set('#48450', { ...structuredClone(partidas.get('#48450')!), vencedor: 'lobos' });
  site = criarSiteSimulado(partidas).listen(0, '127.0.0.1');
  await new Promise((pronto) => site.once('listening', pronto));
  urlDoSite = `http://127.0.0.1:${(site.address() as AddressInfo).port}`;
});
afterEach(async () => {
  site.closeAllConnections();
  await new Promise<void>((fechado) => site.close(() => fechado()));
});

describe('resposta incoerente do site, pelo job', () => {
  it('a #48450 com vencedor "lobos" fica aguardando o site, com o motivo; as outras são conferidas', async () => {
    const criado = await criarTorneio(bd, { nome: 'Setembro', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
    if (!criado.ok) throw new Error('não criou o torneio');
    await importarPlanilha(bd, criado.id, readFileSync(arquivo('torneio-setembro.csv')), 'torneio-setembro.csv');

    const agora = new Date((await horaDoBanco(bd)).getTime() + 2_000);
    await executarRodada({
      bd,
      site: criarClienteSiteOficial({ urlBase: urlDoSite, tempoLimiteMs: 5_000 }),
      agora: () => agora,
      intervalosMs: [60_000],
      lote: 15,
      presaAposMs: 120_000,
    });

    const partidas = await bd('partidas').where({ torneio_id: criado.id });
    const incoerente = partidas.find((p) => p.id_partida === '#48450');
    expect(incoerente).toMatchObject({
      status_conferencia: 'aguardando',
      tentativas: 1,
      vencedor: null,
      origem_do_erro: 'site',
      ultimo_erro: 'O site oficial respondeu dados que não fecham: o vencedor "lobos" não é nenhum dos dois times (Lobos x Corvos).',
    });
    // será tentada de novo, 1 minuto depois
    expect(incoerente.proxima_tentativa_em.getTime()).toBe(Math.floor(agora.getTime() / 1000) * 1000 + 60_000);
    expect(partidas.filter((p) => p.status_conferencia === 'conferida')).toHaveLength(14);
    // nenhuma participação foi gravada para a partida incoerente
    expect(await bd('participacoes').where({ partida_id: incoerente.id })).toEqual([]);

    // o cálculo ainda não libera: uma partida aguardando o site
    const torneio = await consultarTorneio(bd, criado.id, agora);
    expect(torneio!.calculo).toMatchObject({ podeCalcular: false, aguardandoSite: 1 });
  });
});
