import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compararComSite,
  type ItemPendencia,
  type JogadorSite,
  type PartidaSite,
  type RespostaSite,
} from '../../src/dominio/comparacao';
import { lerPlanilha, type LinhaPlanilha } from '../../src/dominio/planilha';

const RAIZ = path.resolve(__dirname, '../../..');
const SITE_OFICIAL: Record<string, PartidaSite> = JSON.parse(
  readFileSync(path.join(RAIZ, 'testes/site-oficial.json'), 'utf8'),
);
const SITE_SETEMBRO: Record<string, PartidaSite> = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/site-setembro.json'), 'utf8'),
);

function lerLinhas(caminho: string): LinhaPlanilha[] {
  const resultado = lerPlanilha(readFileSync(path.join(RAIZ, caminho)));
  if (!resultado.ok) throw new Error(`planilha inválida: ${caminho}`);
  return resultado.linhas;
}

function respostasDoSite(linhas: LinhaPlanilha[], site: Record<string, PartidaSite>) {
  const respostas: Record<string, RespostaSite> = {};
  for (const { idPartida } of linhas) {
    respostas[idPartida] = site[idPartida]
      ? { status: 'encontrada', partida: site[idPartida] }
      : { status: 'nao_encontrada' };
  }
  return respostas;
}

function compararCenario(planilha: string, site = SITE_OFICIAL) {
  const linhas = lerLinhas(planilha);
  return compararComSite(linhas, respostasDoSite(linhas, site));
}

const resumo = (itens: ItemPendencia[]) =>
  itens.map((i) => ({ tipo: i.tipo, idPartida: i.idPartida, nick: i.nick, acao: i.acao }));

describe('compararComSite — cenários de testes/', () => {
  it('01 (limpa): nenhum item e as 15 partidas oficiais', () => {
    const r = compararCenario('testes/planilhas/01-limpa.csv');
    expect(r.pendencias).toEqual([]);
    expect(r.partidasOficiais).toHaveLength(15);
    expect(r.aguardandoSite).toEqual([]);
  });

  it('02: um item de "não encontrada" para a #52214, que fica fora dos dados oficiais', () => {
    const r = compararCenario('testes/planilhas/02-id-inexistente.csv');
    expect(resumo(r.pendencias)).toEqual([
      { tipo: 'nao_encontrada', idPartida: '#52214', nick: undefined, acao: 'corrigir_id' },
    ]);
    expect(r.partidasOficiais).toHaveLength(14);
    expect(r.partidasOficiais.some((p) => p.id === '#52214')).toBe(false);
  });

  it('03: exatamente os 3 itens de valor, planilha × site', () => {
    const r = compararCenario('testes/planilhas/03-divergencias.csv');
    expect(
      r.pendencias.map((i) => [i.tipo, i.nick, i.campo, i.valorPlanilha, i.valorSite, i.acao]),
    ).toEqual([
      ['divergencia', 'Juba', 'kills', '18', '8', 'ciente'],
      ['divergencia', 'Plumada', 'minutos', '15', '27', 'ciente'],
      ['divergencia', 'Harpia', 'kills', '9', '13', 'ciente'],
    ]);
  });

  it('07: um item de jogador em dois times para Garra', () => {
    const r = compararCenario('testes/planilhas/07-jogador-em-dois-times.csv');
    expect(r.pendencias).toHaveLength(1);
    expect(r.pendencias[0]).toMatchObject({
      tipo: 'jogador_dois_times',
      idPartida: null,
      nick: 'Garra',
      acao: 'ciente',
      valorSite: 'Leões e Ursos',
    });
  });

  it('novembro: um item de duplicata (Rapina) e um de nick (mel.zinho)', () => {
    const r = compararCenario('testes/planilhas/torneio-novembro.csv');
    expect(r.pendencias.map((i) => [i.tipo, i.nick, i.valorPlanilha, i.acao])).toEqual([
      ['nick_diferente', 'Mel.zinho', 'mel.zinho', 'ciente'],
      ['duplicata', 'Rapina', expect.stringContaining('2 vezes'), 'ciente'],
    ]);
  });

  it('setembro (original + site da D15): duplicata, nick e um único item da #40923', () => {
    const r = compararCenario('torneio-setembro.csv', SITE_SETEMBRO);
    expect(resumo(r.pendencias)).toEqual([
      { tipo: 'duplicata', idPartida: '#46065', nick: 'Pantera_X', acao: 'ciente' },
      { tipo: 'nick_diferente', idPartida: '#48087', nick: 'xXSniperXx', acao: 'ciente' },
      { tipo: 'sem_dados_planilha', idPartida: '#40923', nick: undefined, acao: 'ciente' },
    ]);
    expect(r.pendencias[0].mensagem).toContain('linhas 38 e 39');
    expect(r.pendencias[1]).toMatchObject({ valorPlanilha: 'xxsniperxx', valorSite: 'xXSniperXx' });
    expect(r.partidasOficiais).toEqual(Object.values(SITE_SETEMBRO));
  });
});

let proximaLinha = 2;
function linha(
  idPartida: string, partida: string, time: string, nick: string,
  minutos: number, kills: number, venceu: boolean | null,
): LinhaPlanilha {
  return { numeroLinha: proximaLinha++, data: '2026-09-05', rodada: 1, idPartida, partida, time, nick, minutos, kills, venceu };
}

const j = (nick: string, time: string, minutos: number, kills: number): JogadorSite => ({ nick, time, minutos, kills });

function encontrada(id: string, times: [string, string], vencedor: string, jogadores: JogadorSite[]): RespostaSite {
  return { status: 'encontrada', partida: { id, data: '2026-09-05', rodada: 1, times, vencedor, jogadores } };
}

function lobosSerpentes(id = '#100') {
  return {
    planilha: [
      linha(id, 'Lobos x Serpentes', 'Lobos', 'Lua_', 40, 10, true),
      linha(id, 'Lobos x Serpentes', 'Lobos', 'Pipoca', 40, 5, true),
      linha(id, 'Lobos x Serpentes', 'Serpentes', 'Naja', 40, 7, false),
      linha(id, 'Lobos x Serpentes', 'Serpentes', 'Bote', 40, 3, false),
    ],
    site: [j('Lua_', 'Lobos', 40, 10), j('Pipoca', 'Lobos', 40, 5), j('Naja', 'Serpentes', 40, 7), j('Bote', 'Serpentes', 40, 3)],
  };
}

describe('compararComSite — casos pequenos', () => {
  it('times diferentes: um único item de corrigir ID, mesmo com jogadores e valores diferentes', () => {
    const { planilha } = lobosSerpentes();
    const r = compararComSite(planilha, {
      '#100': encontrada('#100', ['Corvos', 'Panteras'], 'Corvos', [j('Zeca', 'Corvos', 30, 9), j('Mel', 'Panteras', 30, 4)]),
    });
    expect(r.pendencias).toHaveLength(1);
    expect(r.pendencias[0]).toMatchObject({
      tipo: 'times_diferentes', idPartida: '#100', acao: 'corrigir_id',
      valorPlanilha: 'Lobos x Serpentes', valorSite: 'Corvos x Panteras',
    });
    expect(r.partidasOficiais).toEqual([]);
  });

  it('jogador no time errado E em dois times: dois itens, porque são problemas diferentes', () => {
    const r = compararComSite(
      [
        linha('#201', 'Leões x Águias', 'Leões', 'Garra', 30, 5, true),
        linha('#201', 'Leões x Águias', 'Águias', 'Bico', 30, 2, false),
        linha('#202', 'Leões x Ursos', 'Leões', 'Garra', 30, 6, false),
        linha('#202', 'Leões x Ursos', 'Ursos', 'Panda', 30, 4, true),
      ],
      {
        '#201': encontrada('#201', ['Leões', 'Águias'], 'Leões', [j('Garra', 'Leões', 30, 5), j('Bico', 'Águias', 30, 2)]),
        '#202': encontrada('#202', ['Leões', 'Ursos'], 'Ursos', [j('Garra', 'Ursos', 30, 6), j('Panda', 'Ursos', 30, 4)]),
      },
    );
    expect(r.pendencias.map((i) => [i.tipo, i.idPartida, i.nick, i.campo, i.valorPlanilha, i.valorSite])).toEqual([
      ['divergencia', '#202', 'Garra', 'time', 'Leões', 'Ursos'],
      ['jogador_dois_times', null, 'Garra', undefined, null, 'Leões e Ursos'],
    ]);
  });

  it('vencedor diferente: um item da partida, não um por jogador', () => {
    const { planilha, site } = lobosSerpentes();
    const r = compararComSite(planilha, { '#100': encontrada('#100', ['Lobos', 'Serpentes'], 'Serpentes', site) });
    expect(r.pendencias.map((i) => [i.tipo, i.campo, i.nick, i.valorPlanilha, i.valorSite])).toEqual([
      ['divergencia', 'vencedor', undefined, 'Lobos', 'Serpentes'],
    ]);
  });

  it('vencedor vazio ou incoerente na planilha também é divergência de vencedor', () => {
    const { planilha, site } = lobosSerpentes();
    const semVencedor = planilha.map((l) => ({ ...l, venceu: null }));
    const incoerente = planilha.map((l) => ({ ...l, venceu: true }));
    const resposta = { '#100': encontrada('#100', ['Lobos', 'Serpentes'], 'Lobos', site) };
    expect(compararComSite(semVencedor, resposta).pendencias[0]).toMatchObject({ campo: 'vencedor', valorPlanilha: null, valorSite: 'Lobos' });
    expect(compararComSite(incoerente, resposta).pendencias[0]).toMatchObject({ campo: 'vencedor', valorPlanilha: 'incoerente' });
  });

  it('partida zerada na planilha e com dados no site: exatamente um item, e vale o site', () => {
    const { planilha, site } = lobosSerpentes();
    const zerada = planilha.map((l) => ({ ...l, minutos: 0, kills: 0, venceu: null }));
    const resposta = encontrada('#100', ['Lobos', 'Serpentes'], 'Lobos', site);
    const r = compararComSite(zerada, { '#100': resposta });
    expect(r.pendencias).toHaveLength(1);
    expect(r.pendencias[0]).toMatchObject({
      tipo: 'sem_dados_planilha', idPartida: '#100', acao: 'ciente', valorSite: 'Lobos venceu',
    });
    expect(r.partidasOficiais).toEqual([resposta.status === 'encontrada' && resposta.partida]);
  });

  it('jogador só no site e jogador só na planilha', () => {
    const { planilha, site } = lobosSerpentes();
    const r = compararComSite(
      [...planilha, linha('#100', 'Lobos x Serpentes', 'Lobos', 'Fantasma', 40, 1, true)],
      { '#100': encontrada('#100', ['Lobos', 'Serpentes'], 'Lobos', [...site, j('Tuca', 'Serpentes', 19, 2)]) },
    );
    expect(r.pendencias.map((i) => [i.tipo, i.nick, i.valorPlanilha, i.valorSite])).toEqual([
      ['jogador_so_na_planilha', 'Fantasma', '40 min, 1 kills', null],
      ['jogador_so_no_site', 'Tuca', null, '19 min, 2 kills'],
    ]);
  });

  it('nick diferente com kills diferentes: um item do nick e outro das kills', () => {
    const { planilha, site } = lobosSerpentes();
    planilha[0] = { ...planilha[0], nick: 'LUA_', kills: 12 };
    const r = compararComSite(planilha, { '#100': encontrada('#100', ['Lobos', 'Serpentes'], 'Lobos', site) });
    expect(r.pendencias.map((i) => [i.tipo, i.nick, i.campo, i.valorPlanilha, i.valorSite])).toEqual([
      ['nick_diferente', 'Lua_', undefined, 'LUA_', 'Lua_'],
      ['divergencia', 'Lua_', 'kills', '12', '10'],
    ]);
  });

  it('duplicata com valores diferentes: um único item, com as duas linhas e o valor do site', () => {
    const { planilha, site } = lobosSerpentes();
    const r = compararComSite(
      [...planilha, { ...planilha[0], numeroLinha: 99, minutos: 22 }],
      { '#100': encontrada('#100', ['Lobos', 'Serpentes'], 'Lobos', site) },
    );
    expect(r.pendencias).toHaveLength(1);
    expect(r.pendencias[0]).toMatchObject({ tipo: 'duplicata', nick: 'Lua_', valorSite: '40 min, 10 kills' });
    expect(r.pendencias[0].valorPlanilha).toContain('40 min');
    expect(r.pendencias[0].valorPlanilha).toContain('22 min');
  });

  it('nome do time com acento ou maiúscula diferente: um aviso por time, não "times diferentes"', () => {
    const a = lobosSerpentes('#100');
    const b = lobosSerpentes('#101');
    const semAcento = (linhas: LinhaPlanilha[]) =>
      linhas.map((l) => (l.time === 'Serpentes' ? { ...l, time: 'serpentes' } : l));
    const r = compararComSite([...semAcento(a.planilha), ...semAcento(b.planilha)], {
      '#100': encontrada('#100', ['Lobos', 'Serpentes'], 'Lobos', a.site),
      '#101': encontrada('#101', ['Lobos', 'Serpentes'], 'Lobos', b.site),
    });
    expect(r.pendencias.map((i) => [i.tipo, i.idPartida, i.valorPlanilha, i.valorSite, i.acao])).toEqual([
      ['time_escrito_diferente', null, 'serpentes', 'Serpentes', 'ciente'],
    ]);
    expect(r.partidasOficiais).toHaveLength(2);
  });

  it('data e rodada diferentes não geram item (não mudam o dinheiro)', () => {
    const { planilha, site } = lobosSerpentes();
    const r = compararComSite(
      planilha.map((l) => ({ ...l, data: '2026-01-01', rodada: 4 })),
      { '#100': encontrada('#100', ['Lobos', 'Serpentes'], 'Lobos', site) },
    );
    expect(r.pendencias).toEqual([]);
  });

  it('partida que o site ainda não respondeu fica em "aguardando", sem item', () => {
    const { planilha } = lobosSerpentes();
    const r = compararComSite(planilha, {});
    expect(r.pendencias).toEqual([]);
    expect(r.aguardandoSite).toEqual(['#100']);
    expect(r.partidasOficiais).toEqual([]);
  });

  it('todo item tem ação e uma mensagem para a Maria', () => {
    const r = compararCenario('torneio-setembro.csv', SITE_SETEMBRO);
    for (const item of r.pendencias) {
      expect(['ciente', 'corrigir_id']).toContain(item.acao);
      expect(item.mensagem.length).toBeGreaterThan(20);
    }
  });
});
