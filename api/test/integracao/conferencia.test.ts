import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp as criarSiteSimulado } from '../../../site-oficial-simulado/src/app';
import { carregarPartidas } from '../../../site-oficial-simulado/src/dados';
import { executarRodada, type OpcoesRodada } from '../../src/conferencia/job';
import { criarClienteSiteOficial, type SiteOficial } from '../../src/conferencia/site-oficial';
import { gravarNaoEncontrada, recuperarPresas, reservarPartidas } from '../../src/repositorios/conferencia';
import { criarTorneio, importarPlanilha, tentarAgora } from '../../src/servicos/torneios';
import { conectarAoBancoDeTeste, esvaziarTabelas, horaDoBanco } from './banco-de-teste';

// Arquivos só lidos: as planilhas e os dados do site simulado.
const RAIZ = path.resolve(__dirname, '../../..');
const arquivo = (relativo: string) => path.join(RAIZ, relativo);
const DADOS_DO_SITE = [arquivo('testes/site-oficial.json'), arquivo('api/test/fixtures/site-setembro.json')];
const SITE_SETEMBRO: Record<string, { jogadores: unknown[] }> = JSON.parse(readFileSync(DADOS_DO_SITE[1], 'utf8'));

const MINUTO = 60_000;

let bd: Knex;
let siteSimulado: Server;
let site: SiteOficial;
/** O relógio do job; cada teste avança quando quer, sem esperar de verdade. */
let agora: Date;

beforeAll(() => {
  bd = conectarAoBancoDeTeste();
});
afterAll(() => bd.destroy());

beforeEach(async () => {
  await esvaziarTabelas(bd);
  // um site novo a cada teste: as falhas programadas (novembro) recomeçam do zero; sem demora
  siteSimulado = criarSiteSimulado(carregarPartidas(DADOS_DO_SITE)).listen(0, '127.0.0.1');
  await new Promise((pronto) => siteSimulado.once('listening', pronto));
  site = criarClienteSiteOficial({
    urlBase: `http://127.0.0.1:${(siteSimulado.address() as AddressInfo).port}`,
    tempoLimiteMs: 5_000,
  });
  // 2 s à frente do relógio do MySQL, o mesmo que grava a próxima tentativa na importação: as
  // partidas recém-importadas já estão prontas (a folga cobre o tempo entre esta linha e a
  // importação de cada teste, não a diferença entre os relógios do Node e do MySQL)
  agora = new Date((await horaDoBanco(bd)).getTime() + 2_000);
});
afterEach(async () => {
  vi.restoreAllMocks();
  siteSimulado.closeAllConnections();
  await new Promise<void>((fechado) => siteSimulado.close(() => fechado()));
});

/** Registra cada consulta feita ao site e permite fazer algo no meio dela. */
function espiar(original: SiteOficial, duranteAConsulta?: (idPartida: string) => Promise<void>) {
  const consultas: string[] = [];
  const espiao: SiteOficial = {
    async consultarPartida(idPartida) {
      consultas.push(idPartida);
      await duranteAConsulta?.(idPartida);
      return original.consultarPartida(idPartida);
    },
  };
  return { consultas, site: espiao };
}

const opcoes = (sobrescrever: Partial<OpcoesRodada> = {}): OpcoesRodada => ({
  bd,
  site,
  agora: () => agora,
  intervalosMs: [1 * MINUTO, 2 * MINUTO, 5 * MINUTO, 10 * MINUTO],
  lote: 3,
  presaAposMs: 2 * MINUTO,
  ...sobrescrever,
});

async function torneioCom(planilha: string): Promise<number> {
  const criado = await criarTorneio(bd, { nome: planilha, premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
  if (!criado.ok) throw new Error('não criou o torneio');
  const importada = await importarPlanilha(bd, criado.id, readFileSync(arquivo(planilha)), path.basename(planilha));
  if (importada.tipo !== 'importada') throw new Error(`não importou ${planilha}: ${JSON.stringify(importada)}`);
  return criado.id;
}

interface LinhaPartida {
  id: number;
  id_partida: string;
  status_conferencia: string;
  vencedor: string | null;
  tentativas: number;
  proxima_tentativa_em: Date | null;
  ultima_tentativa_em: Date | null;
  em_consulta_desde: Date | null;
  ultimo_erro: string | null;
  origem_do_erro: 'site' | 'interno' | null;
}
const partidas = (torneioId: number): Promise<LinhaPartida[]> =>
  bd('partidas').where({ torneio_id: torneioId }).orderBy('id');
const partida = async (torneioId: number, idPartida: string): Promise<LinhaPartida> =>
  bd('partidas').where({ torneio_id: torneioId, id_partida: idPartida }).first();
const participacoes = (partidaId: number) => bd('participacoes').where({ partida_id: partidaId }).orderBy('id');

describe('setembro: tudo conferido numa rodada', () => {
  it('as 15 partidas ficam "conferidas", com o vencedor e as participações do site', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const resumo = await executarRodada(opcoes());

    expect(resumo).toMatchObject({ consultadas: 15, conferidas: 15, naoEncontradas: 0, indisponiveis: 0, descartadas: 0 });
    const todas = await partidas(id);
    expect(todas.every((p) => p.status_conferencia === 'conferida')).toBe(true);
    expect(todas.every((p) => p.tentativas === 0 && p.em_consulta_desde === null && p.proxima_tentativa_em === null)).toBe(true);
    expect(todas.every((p) => p.ultima_tentativa_em !== null)).toBe(true);

    // todas as participações do site, nem uma a mais
    const esperadas = todas.reduce((total, p) => total + SITE_SETEMBRO[p.id_partida].jogadores.length, 0);
    const [{ n }] = await bd('participacoes').count({ n: '*' });
    expect(Number(n)).toBe(esperadas);
  });

  it('#40923, zerada na planilha, fica com os dados da D15: vitória de Falcões, 62 × 45 kills, 38 min para todos', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    await executarRodada(opcoes());

    const p = await partida(id, '#40923');
    expect(p.vencedor).toBe('Falcões');
    const jogadores = await participacoes(p.id);
    expect(jogadores).toHaveLength(10);
    expect(jogadores.every((j: { minutos: number }) => j.minutos === 38)).toBe(true);
    const kills = (time: string) =>
      jogadores.filter((j: { time: string }) => j.time === time).reduce((s: number, j: { kills: number }) => s + j.kills, 0);
    expect(kills('Falcões')).toBe(62);
    expect(kills('Panteras')).toBe(45);
    expect(jogadores.find((j: { nick: string }) => j.nick === 'Dudu.pro')).toMatchObject({ time: 'Falcões', minutos: 38, kills: 16 });
  });

  it('o nick vem como o site registra: xXSniperXx, e não o xxsniperxx da planilha', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    await executarRodada(opcoes());
    const nicks = (await participacoes((await partida(id, '#48087')).id)).map((j: { nick: string }) => j.nick);
    expect(nicks).toContain('xXSniperXx');
    expect(nicks).not.toContain('xxsniperxx');
  });
});

describe('cenário 02: ID que não existe no site', () => {
  it('#52214 fica "nao_encontrada" e sai da fila; as outras 14 são conferidas', async () => {
    const id = await torneioCom('testes/planilhas/02-id-inexistente.csv');
    const resumo = await executarRodada(opcoes());
    expect(resumo).toMatchObject({ consultadas: 15, conferidas: 14, naoEncontradas: 1 });

    const p = await partida(id, '#52214');
    expect(p).toMatchObject({ status_conferencia: 'nao_encontrada', tentativas: 0, proxima_tentativa_em: null, em_consulta_desde: null });
    expect(await participacoes(p.id)).toEqual([]);

    // só uma correção do ID consulta de novo (D5, D16): o job não volta a ela
    agora = new Date(agora.getTime() + 60 * MINUTO);
    const espiao = espiar(site);
    await executarRodada(opcoes({ site: espiao.site }));
    expect(espiao.consultas).toEqual([]);
  });
});

describe('novembro: partidas instáveis no site', () => {
  it('falham, são reagendadas em 1, 2, 5 e 10 min, guardando o erro, e depois são conferidas', async () => {
    const id = await torneioCom('testes/planilhas/torneio-novembro.csv');
    const inicio = agora;

    const primeira = await executarRodada(opcoes());
    expect(primeira).toMatchObject({ indisponiveis: 2, conferidas: (await partidas(id)).length - 2 });
    for (const instavel of ['#62142', '#62477']) {
      expect(await partida(id, instavel)).toMatchObject({
        status_conferencia: 'aguardando',
        tentativas: 1,
        proxima_tentativa_em: new Date(Math.floor(inicio.getTime() / 1000) * 1000 + MINUTO),
        em_consulta_desde: null,
        ultimo_erro: 'O site oficial respondeu que está fora do ar (erro 503).',
      });
    }

    // antes da hora marcada, ninguém é consultado
    agora = new Date(inicio.getTime() + 30_000);
    const cedo = espiar(site);
    await executarRodada(opcoes({ site: cedo.site }));
    expect(cedo.consultas).toEqual([]);

    // a cada rodada, o relógio pula para a próxima tentativa marcada
    const consultasDasInstaveis: string[] = [];
    for (let rodada = 0; rodada < 10; rodada++) {
      const aguardando = (await partidas(id)).filter((p) => p.status_conferencia === 'aguardando');
      if (aguardando.length === 0) break;
      agora = new Date(Math.min(...aguardando.map((p) => p.proxima_tentativa_em!.getTime())));
      const espiao = espiar(site);
      await executarRodada(opcoes({ site: espiao.site }));
      consultasDasInstaveis.push(...espiao.consultas);
    }

    // #62142 falha 2 vezes; #62477, 5 vezes. Depois respondem.
    expect(await partida(id, '#62142')).toMatchObject({ status_conferencia: 'conferida', tentativas: 2, ultimo_erro: null });
    expect(await partida(id, '#62477')).toMatchObject({ status_conferencia: 'conferida', tentativas: 5, ultimo_erro: null });
    expect(consultasDasInstaveis.filter((c) => c === '#62142')).toHaveLength(2);
    expect(consultasDasInstaveis.filter((c) => c === '#62477')).toHaveLength(5);
    expect((await partidas(id)).every((p) => p.status_conferencia === 'conferida')).toBe(true);
  });

  it('a falha do site fica marcada como do site, e some quando a partida é conferida', async () => {
    const id = await torneioCom('testes/planilhas/torneio-novembro.csv');
    await executarRodada(opcoes());
    expect(await partida(id, '#62142')).toMatchObject({ status_conferencia: 'aguardando', origem_do_erro: 'site' });
    agora = new Date(agora.getTime() + 10 * MINUTO);
    await executarRodada(opcoes());
    agora = new Date(agora.getTime() + 10 * MINUTO);
    await executarRodada(opcoes());
    expect(await partida(id, '#62142')).toMatchObject({ status_conferencia: 'conferida', origem_do_erro: null, ultimo_erro: null });
  });

  it('"tentar agora" antecipa, mas não zera a agenda: a falha seguinte espera o intervalo de onde parou', async () => {
    const id = await torneioCom('testes/planilhas/torneio-novembro.csv');
    const inicio = agora;
    await executarRodada(opcoes()); // 1ª falha de #62477: próxima em 1 min
    agora = new Date(inicio.getTime() + MINUTO);
    await executarRodada(opcoes()); // 2ª falha: próxima em 2 min

    // 10 s depois, a Maria clica em "tentar agora"
    agora = new Date(agora.getTime() + 10_000);
    expect(await tentarAgora(bd, id, agora)).toMatchObject({ tipo: 'antecipadas' });
    expect((await partida(id, '#62477')).proxima_tentativa_em).toEqual(new Date(Math.floor(agora.getTime() / 1000) * 1000));

    await executarRodada(opcoes()); // 3ª falha: o intervalo segue a agenda, 5 min, e não volta para 1 min
    const p = await partida(id, '#62477');
    expect(p.tentativas).toBe(3);
    expect(p.proxima_tentativa_em!.getTime() - p.ultima_tentativa_em!.getTime()).toBe(5 * MINUTO);
  });

  it('a espera cresce: 1, 2, 5, 10 e 10 minutos entre as falhas de #62477', async () => {
    const id = await torneioCom('testes/planilhas/torneio-novembro.csv');
    const esperas: number[] = [];
    for (let falha = 1; falha <= 5; falha++) {
      await executarRodada(opcoes());
      const p = await partida(id, '#62477');
      esperas.push((p.proxima_tentativa_em!.getTime() - p.ultima_tentativa_em!.getTime()) / MINUTO);
      agora = p.proxima_tentativa_em!;
    }
    expect(esperas).toEqual([1, 2, 5, 10, 10]);
  });
});

describe('concorrência', () => {
  it('cinco execuções do job ao mesmo tempo nunca consultam a mesma partida', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    // cada consulta demora um pouco, para as execuções se sobreporem de verdade
    const espiao = espiar(site, () => new Promise((pronto) => setTimeout(pronto, 30)));

    const resumos = await Promise.all(Array.from({ length: 5 }, () => executarRodada(opcoes({ site: espiao.site }))));

    expect(espiao.consultas).toHaveLength(15);
    expect(new Set(espiao.consultas).size).toBe(15);
    expect(resumos.reduce((total, r) => total + r.conferidas, 0)).toBe(15);
    expect((await partidas(id)).every((p) => p.status_conferencia === 'conferida')).toBe(true);
  });

  it('SKIP LOCKED: a reserva pula, sem esperar, as partidas travadas por outra execução', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const travadas = (await partidas(id)).slice(0, 3).map((p) => p.id);

    // outra execução no meio da reserva: as 3 primeiras estão travadas numa transação aberta
    const outra = await bd.transaction();
    try {
      await outra('partidas').whereIn('id', travadas).forUpdate().select('id');
      const inicio = Date.now();
      const reservadas = await reservarPartidas(bd, { limite: agora, agora, quantidade: 50 });
      expect(Date.now() - inicio).toBeLessThan(2_000); // sem SKIP LOCKED, ficaria esperando a trava
      expect(reservadas).toHaveLength(12);
      expect(reservadas.some((r) => travadas.includes(r.id))).toBe(false);
    } finally {
      await outra.rollback();
    }
  });
});

describe('recuperação de partida presa', () => {
  it('em "em_consulta" há mais de 2 min (o processo caiu): volta para a fila, sem contar tentativa, e é conferida', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const [presa, emAndamento, ...resto] = await partidas(id);
    await bd('partidas').whereIn('id', resto.map((p) => p.id)).update({ status_conferencia: 'conferida', proxima_tentativa_em: null });
    await bd('partidas').where({ id: presa.id }).update({ status_conferencia: 'em_consulta', em_consulta_desde: new Date(agora.getTime() - 3 * MINUTO) });
    await bd('partidas').where({ id: emAndamento.id }).update({ status_conferencia: 'em_consulta', em_consulta_desde: new Date(agora.getTime() - 30_000) });

    const espiao = espiar(site);
    const resumo = await executarRodada(opcoes({ site: espiao.site }));

    expect(resumo).toMatchObject({ recuperadas: 1, consultadas: 1, conferidas: 1 });
    expect(espiao.consultas).toEqual([presa.id_partida]);
    expect((await partida(id, presa.id_partida)).origem_do_erro).toBeNull(); // conferida: o erro sumiu
    expect(await partida(id, presa.id_partida)).toMatchObject({ status_conferencia: 'conferida', tentativas: 0, ultimo_erro: null });
    // a que está em consulta há 30 s pode estar viva: não é tocada
    expect(await partida(id, emAndamento.id_partida)).toMatchObject({ status_conferencia: 'em_consulta' });
  });

  it('a partida recuperada aparece como erro interno, não do site', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const [presa] = await partidas(id);
    await bd('partidas').where({ id: presa.id }).update({ status_conferencia: 'em_consulta', em_consulta_desde: new Date(agora.getTime() - 3 * MINUTO) });
    await recuperarPresas(bd, { presaAntesDe: new Date(agora.getTime() - 2 * MINUTO), agora });
    expect(await partida(id, presa.id_partida)).toMatchObject({
      status_conferencia: 'aguardando',
      origem_do_erro: 'interno',
      ultimo_erro: 'A consulta foi interrompida antes de terminar e será feita de novo.',
    });
  });

  it('a consulta antiga que termina depois da recuperação é descartada: não grava por cima', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const lenta = await partida(id, '#40923');
    await bd('partidas').where({ torneio_id: id }).whereNot({ id: lenta.id }).update({ status_conferencia: 'conferida', proxima_tentativa_em: null });

    // a primeira execução reserva a #40923 e "trava" no meio da consulta; enquanto isso, o tempo
    // passa, uma segunda execução recupera a partida e a confere
    let soltarLenta!: () => void;
    const lentaEsperando = new Promise<void>((pronto) => { soltarLenta = pronto; });
    let lentaComecou!: () => void;
    const comecou = new Promise<void>((pronto) => { lentaComecou = pronto; });
    const travada = espiar(site, async () => { lentaComecou(); await lentaEsperando; });
    const primeira = executarRodada(opcoes({ site: travada.site }));
    await comecou;

    agora = new Date(agora.getTime() + 3 * MINUTO);
    const segunda = await executarRodada(opcoes());
    expect(segunda).toMatchObject({ recuperadas: 1, conferidas: 1 });

    soltarLenta();
    expect(await primeira).toMatchObject({ consultadas: 1, conferidas: 0, descartadas: 1 });
    expect(await participacoes(lenta.id)).toHaveLength(10); // uma vez só, não duplicadas
  });
});

describe('erro inesperado numa partida', () => {
  const ESPERA_DEPOIS_DE_ERRO = 'Erro inesperado ao conferir a partida; ela será consultada de novo.';

  it('o cliente do site lança um erro: a rodada segue, e a partida volta para a fila em 1 min, sem contar tentativa', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const erros = vi.spyOn(console, 'error').mockImplementation(() => {});
    const quebrado: SiteOficial = {
      async consultarPartida(idPartida) {
        if (idPartida === '#40923') throw new Error('defeito no cliente');
        return site.consultarPartida(idPartida);
      },
    };

    const resumo = await executarRodada(opcoes({ site: quebrado }));

    expect(resumo).toMatchObject({ consultadas: 15, conferidas: 14, erros: 1 });
    expect(erros).toHaveBeenCalled();
    const p = await partida(id, '#40923');
    expect(p).toMatchObject({ status_conferencia: 'aguardando', tentativas: 0, em_consulta_desde: null, ultimo_erro: ESPERA_DEPOIS_DE_ERRO, origem_do_erro: 'interno' });
    expect(p.proxima_tentativa_em!.getTime() - p.ultima_tentativa_em!.getTime()).toBe(MINUTO);

    // na próxima vez, com o cliente bom, é conferida
    agora = p.proxima_tentativa_em!;
    expect(await executarRodada(opcoes())).toMatchObject({ conferidas: 1 });
    expect(await partida(id, '#40923')).toMatchObject({ status_conferencia: 'conferida', ultimo_erro: null });
  });

  it('o MySQL recusa a gravação no meio: nada fica pela metade, e a partida volta para a fila', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // um nick maior que a coluna (80): o INSERT das participações falha depois do UPDATE da partida
    const nickGrande: SiteOficial = {
      async consultarPartida(idPartida) {
        const resultado = await site.consultarPartida(idPartida);
        if (idPartida !== '#40923' || resultado.status !== 'encontrada') return resultado;
        const [primeiro, ...outros] = resultado.partida.jogadores;
        return { ...resultado, partida: { ...resultado.partida, jogadores: [{ ...primeiro, nick: 'x'.repeat(81) }, ...outros] } };
      },
    };

    const resumo = await executarRodada(opcoes({ site: nickGrande }));

    expect(resumo).toMatchObject({ conferidas: 14, erros: 1 });
    const p = await partida(id, '#40923');
    // a transação desfez o UPDATE: sem vencedor, sem participações, de volta à fila
    expect(p).toMatchObject({ status_conferencia: 'aguardando', vencedor: null, tentativas: 0, ultimo_erro: ESPERA_DEPOIS_DE_ERRO });
    expect(await participacoes(p.id)).toEqual([]);
  });
});

describe('o recibo da reserva (em_consulta_desde)', () => {
  it('guarda os milissegundos', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const horario = new Date(Math.floor(agora.getTime() / 1000) * 1000 + 123);
    await reservarPartidas(bd, { limite: horario, agora: horario, quantidade: 1 });
    const [reservada] = await bd('partidas').where({ torneio_id: id, status_conferencia: 'em_consulta' });
    expect(reservada.em_consulta_desde).toEqual(horario);
  });

  it('duas reservas da mesma partida no mesmo segundo têm recibos diferentes: a mais antiga não grava', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    const segundo = Math.floor(agora.getTime() / 1000) * 1000;
    const [antiga] = await reservarPartidas(bd, { limite: agora, agora: new Date(segundo + 100), quantidade: 1 });
    // a partida voltou para a fila (por exemplo, o ID foi corrigido) e foi reservada de novo no mesmo segundo
    await bd('partidas').where({ id: antiga.id }).update({ status_conferencia: 'aguardando', em_consulta_desde: null });
    const [nova] = await reservarPartidas(bd, { limite: agora, agora: new Date(segundo + 900), quantidade: 1 });
    expect(nova.id).toBe(antiga.id);

    expect(await gravarNaoEncontrada(bd, antiga)).toBe(false);
    expect(await gravarNaoEncontrada(bd, nova)).toBe(true);
    expect((await partida(id, nova.idPartida)).status_conferencia).toBe('nao_encontrada');
  });
});

describe('partida apagada no meio da consulta (planilha substituída, D22)', () => {
  it('o job descarta o resultado sem erro, e nada da planilha antiga fica gravado', async () => {
    const id = await torneioCom('torneio-setembro.csv');
    let substituiu = false;
    const espiao = espiar(site, async (idPartida) => {
      if (idPartida === '#40923' && !substituiu) {
        substituiu = true;
        const nova = await importarPlanilha(bd, id, readFileSync(arquivo('testes/planilhas/01-limpa.csv')), '01-limpa.csv');
        expect(nova.tipo).toBe('importada');
      }
    });

    const resumo = await executarRodada(opcoes({ site: espiao.site }));

    expect(resumo.descartadas).toBeGreaterThanOrEqual(1);
    expect(resumo.erros).toBe(0);
    const ids = (await partidas(id)).map((p) => p.id_partida);
    expect(ids).not.toContain('#40923');
    expect(ids).toHaveLength(15); // as partidas da planilha nova
    // nenhuma participação de setembro sobrou (a da #40923 nunca foi gravada)
    const nicks = (await bd('participacoes').select('nick')).map((j: { nick: string }) => j.nick);
    expect(nicks).not.toContain('Dudu.pro');
  });
});
