import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarApp as criarSiteSimulado } from '../../../site-oficial-simulado/src/app';
import { carregarPartidas } from '../../../site-oficial-simulado/src/dados';
import { executarRodada } from '../../src/conferencia/job';
import { criarClienteSiteOficial, type SiteOficial } from '../../src/conferencia/site-oficial';
import type { ModoDivisao } from '../../src/dominio/rateio';
import { buscarResultado } from '../../src/repositorios/resultado';
import { calcularEGravar } from '../../src/servicos/calculo';
import { corrigirId } from '../../src/servicos/partidas';
import { criarTorneio, importarPlanilha } from '../../src/servicos/torneios';
import { conectarAoBancoDeTeste, esvaziarTabelas } from './banco-de-teste';

// Arquivos só lidos: planilhas, dados do site e resultados esperados.
const RAIZ = path.resolve(__dirname, '../../..');
const arquivo = (relativo: string) => path.join(RAIZ, relativo);
const DADOS_DO_SITE = [arquivo('testes/site-oficial.json'), arquivo('api/test/fixtures/site-setembro.json')];
const MINUTO = 60_000;

let bd: Knex;
let siteSimulado: Server;
let site: SiteOficial;

beforeAll(() => {
  bd = conectarAoBancoDeTeste();
});
afterAll(() => bd.destroy());
beforeEach(async () => {
  await esvaziarTabelas(bd);
  siteSimulado = criarSiteSimulado(carregarPartidas(DADOS_DO_SITE)).listen(0, '127.0.0.1');
  await new Promise((pronto) => siteSimulado.once('listening', pronto));
  site = criarClienteSiteOficial({ urlBase: `http://127.0.0.1:${(siteSimulado.address() as AddressInfo).port}`, tempoLimiteMs: 5_000 });
});
afterEach(async () => {
  siteSimulado.closeAllConnections();
  await new Promise<void>((fechado) => siteSimulado.close(() => fechado()));
});

/** Importa a planilha e roda o job até o site responder tudo (o relógio avança até cada nova tentativa). */
async function torneioConferido(planilha: string, modoDivisao: ModoDivisao = 'minutos'): Promise<number> {
  const criado = await criarTorneio(bd, { nome: planilha, premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao });
  if (!criado.ok) throw new Error('não criou');
  const importada = await importarPlanilha(bd, criado.id, readFileSync(arquivo(planilha)), path.basename(planilha));
  if (importada.tipo !== 'importada') throw new Error(`não importou ${planilha}`);
  await conferirTudo(criado.id);
  return criado.id;
}

async function conferirTudo(torneioId: number) {
  let agora = new Date(Date.now() + 2_000);
  for (let rodada = 0; rodada < 20; rodada++) {
    await executarRodada({ bd, site, agora: () => agora, intervalosMs: [MINUTO], lote: 3, presaAposMs: 2 * MINUTO });
    const proxima: { p: Date | null } | undefined = await bd('partidas').where({ torneio_id: torneioId, status_conferencia: 'aguardando' }).min({ p: 'proxima_tentativa_em' }).first();
    if (!proxima?.p) return;
    agora = new Date(Math.max(agora.getTime(), proxima.p.getTime()));
  }
  throw new Error('o site não respondeu todas as partidas');
}

const centavos = (texto: string) => {
  const [reais, cent] = texto.split(',');
  return Number(reais) * 100 + Number(cent);
};
const linhasDoCsv = (nome: string) => readFileSync(arquivo(`testes/esperado/${nome}`), 'utf8').split(/\r?\n/).filter(Boolean).slice(1).map((l) => l.split(';'));

function classificacaoEsperada(nome: string) {
  return linhasDoCsv(`${nome}-classificacao.csv`).map(([posicao, time, vitorias, kills, premio, criterio]) => ({
    posicao: Number(posicao), time, vitorias: Number(vitorias), killsTime: Number(kills), premioCentavos: centavos(premio), criterio: criterio || null,
  }));
}
function jogadoresEsperados(nome: string) {
  return linhasDoCsv(`${nome}-jogadores.csv`).map(([time, nick, minutos, minutosTime, premio]) => ({
    time, nick, minutos: Number(minutos), baseTime: Number(minutosTime), premioCentavos: centavos(premio),
  }));
}
const porChave = <T extends { time: string; nick: string }>(lista: T[]) =>
  [...lista].sort((a, b) => `${a.time}|${a.nick}`.localeCompare(`${b.time}|${b.nick}`));

describe('calcular e gravar: os cenários contra testes/esperado/, centavo por centavo', () => {
  it.each([
    ['01-limpa', 'testes/planilhas/01-limpa.csv'],
    ['04-empate-em-kills', 'testes/planilhas/04-empate-em-kills.csv'],
    ['05-oito-times', 'testes/planilhas/05-oito-times.csv'],
    ['torneio-outubro', 'testes/planilhas/torneio-outubro.csv'],
    ['torneio-setembro', 'torneio-setembro.csv'],
  ])('%s', async (nome, planilha) => {
    const id = await torneioConferido(planilha);
    await calcularEGravar(bd, id, new Date('2026-10-15T13:00:00.000Z'));
    const gravado = (await buscarResultado(bd, id))!;

    expect(gravado.times.map(({ posicao, time, vitorias, killsTime, premioCentavos, criterio }) => ({ posicao, time, vitorias, killsTime, premioCentavos, criterio })))
      .toEqual(classificacaoEsperada(nome));
    expect(porChave(gravado.jogadores.map(({ time, nick, minutos, baseTime, premioCentavos }) => ({ time, nick, minutos, baseTime, premioCentavos }))))
      .toEqual(porChave(jogadoresEsperados(nome)));
  }, 60_000);
});

describe('setembro gravado', () => {
  it('Lobos R$ 5.000 (R$ 1.000 cada); Corvos R$ 3.000 com Tuca R$ 65,90; Falcões e Tubarões em 3º com R$ 1.000 (R$ 200 cada)', async () => {
    const id = await torneioConferido('torneio-setembro.csv');
    await calcularEGravar(bd, id, new Date('2026-10-15T13:00:00.000Z'));
    const { times, jogadores } = (await buscarResultado(bd, id))!;
    const time = (nome: string) => times.find((t) => t.time === nome)!;
    const doTime = (nome: string) => jogadores.filter((j) => j.time === nome);

    expect(time('Lobos')).toMatchObject({ posicao: 1, premioCentavos: 500_000 });
    expect(doTime('Lobos').map((j) => j.premioCentavos)).toEqual([100_000, 100_000, 100_000, 100_000, 100_000]);
    expect(time('Corvos')).toMatchObject({ posicao: 2, premioCentavos: 300_000 });
    expect(doTime('Corvos').find((j) => j.nick === 'Tuca')).toMatchObject({ minutos: 19, premioCentavos: 6_590, recebeuCentavo: true });
    for (const empatado of ['Falcões', 'Tubarões']) {
      expect(time(empatado)).toMatchObject({ posicao: 3, premioCentavos: 100_000, criterio: 'divisão igual (empate em vitórias e kills)' });
      expect(doTime(empatado).map((j) => j.premioCentavos)).toEqual([20_000, 20_000, 20_000, 20_000, 20_000]);
    }
    // nick como o site registra (D7)
    expect(doTime('Lobos').map((j) => j.nick)).toContain('xXSniperXx');
  });

  it('guarda a data do cálculo e a configuração usada, congeladas', async () => {
    const id = await torneioConferido('torneio-setembro.csv');
    const quando = new Date('2026-10-15T13:00:00.123Z');
    await calcularEGravar(bd, id, quando);
    expect(await buscarResultado(bd, id)).toMatchObject({ calculadoEm: quando, premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
  });

  it('cada jogador guarda time, nick, minutos, kills, base, valor e se recebeu centavo', async () => {
    const id = await torneioConferido('torneio-setembro.csv');
    await calcularEGravar(bd, id);
    const { jogadores } = (await buscarResultado(bd, id))!;
    expect(jogadores.find((j) => j.nick === 'xXSniperXx')).toEqual({
      time: 'Lobos', nick: 'xXSniperXx', minutos: 211, kills: 89, base: 211, baseTime: 1055, baseUsada: 'minutos',
      premioCentavos: 100_000, recebeuCentavo: false, explicacao: null,
    });
  });

  it('modo kills (D1): os valores dos Lobos do contexto.md, seção 8', async () => {
    const id = await torneioConferido('torneio-setembro.csv', 'kills');
    await calcularEGravar(bd, id);
    const { jogadores } = (await buscarResultado(bd, id))!;
    const valor = (nick: string) => jogadores.find((j) => j.time === 'Lobos' && j.nick === nick)!.premioCentavos;
    expect(['xXSniperXx', 'Lua_', 'Pipoca', 'R4mbo', 'Dona.Tank'].map(valor)).toEqual([126_062, 124_646, 94_901, 83_569, 70_822]);
  });
});

describe('as somas fecham em todos os cenários que dá para calcular', () => {
  it.each([
    'testes/planilhas/01-limpa.csv',
    'testes/planilhas/03-divergencias.csv',
    'testes/planilhas/04-empate-em-kills.csv',
    'testes/planilhas/05-oito-times.csv',
    // 06a (coluna faltando) é recusada na importação; 06b só testa o separador: os IDs dela não
    // existem no site simulado, então não há o que calcular
    'testes/planilhas/07-jogador-em-dois-times.csv',
    'testes/planilhas/torneio-outubro.csv',
    'testes/planilhas/torneio-novembro.csv',
    'torneio-setembro.csv',
  ])('%s: todos os jogadores = prêmio total; cada time = o valor do time', async (planilha) => {
    const id = await torneioConferido(planilha);
    await calcularEGravar(bd, id);
    const { times, jogadores } = (await buscarResultado(bd, id))!;
    expect(times.reduce((s, t) => s + t.premioCentavos, 0)).toBe(1_000_000);
    expect(jogadores.reduce((s, j) => s + j.premioCentavos, 0)).toBe(1_000_000);
    for (const t of times) {
      expect(jogadores.filter((j) => j.time === t.time).reduce((s, j) => s + j.premioCentavos, 0)).toBe(t.premioCentavos);
    }
  }, 60_000);

  it('cenário 02, depois de corrigir o ID: as somas fecham', async () => {
    const id = await torneioConferido('testes/planilhas/02-id-inexistente.csv');
    const errada = await bd('partidas').where({ torneio_id: id, id_partida: '#52214' }).first();
    expect((await corrigirId(bd, id, errada.id, '#52241')).tipo).toBe('corrigida');
    await conferirTudo(id);
    await calcularEGravar(bd, id);
    const { jogadores } = (await buscarResultado(bd, id))!;
    expect(jogadores.reduce((s, j) => s + j.premioCentavos, 0)).toBe(1_000_000);
  }, 60_000);

  it('cenário 07 (D13): Garra recebe separado por cada time premiado em que jogou', async () => {
    const id = await torneioConferido('testes/planilhas/07-jogador-em-dois-times.csv');
    await calcularEGravar(bd, id);
    const { times, jogadores } = (await buscarResultado(bd, id))!;
    const premiados = new Set(times.filter((t) => t.premioCentavos > 0).map((t) => t.time));
    const timesDoGarra = jogadores.filter((j) => j.nick === 'Garra').map((j) => j.time);
    expect(timesDoGarra.length).toBeGreaterThan(0);
    expect(timesDoGarra.every((t) => premiados.has(t))).toBe(true);
    expect(new Set(timesDoGarra).size).toBe(timesDoGarra.length); // uma linha por time
  }, 60_000);
});
