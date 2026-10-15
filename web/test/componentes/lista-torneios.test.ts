// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { rotas } from '../../src/roteador';
import PaginaTorneios from '../../src/paginas/PaginaTorneios.vue';
import type { ResumoTorneio } from '../../src/servicos/api';

function torneio(extra: Partial<ResumoTorneio>): ResumoTorneio {
  return {
    id: 1, nome: 'Torneio', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos', status: 'importado',
    calculadoEm: null, planilhaArquivo: 'torneio.csv', planilhaImportadaEm: '2026-10-14T13:00:00.000Z', planilhaConvertidaDeWindows1252: false,
    criadoEm: '2026-10-14T13:00:00.000Z', quantidadeDePartidas: 15, primeiraPartidaEm: '2026-10-03', ...extra,
  };
}

// hoje: 15/10/2026. Em andamento: um de outubro sem planilha e um de agosto que ainda não terminou.
const TORNEIOS = [
  torneio({ id: 5, nome: 'Torneio de outubro', status: 'criado', planilhaArquivo: null, quantidadeDePartidas: 0, primeiraPartidaEm: null, criadoEm: '2026-10-13T15:00:00.000Z', premioCentavos: 1_200_000 }),
  torneio({ id: 4, nome: 'Copa de Primavera', modoDivisao: 'kills', status: 'conferindo', primeiraPartidaEm: '2026-08-30', criadoEm: '2026-08-29T15:00:00.000Z', premioCentavos: 500_000 }),
  torneio({ id: 3, nome: 'Copa relâmpago', status: 'calculado', primeiraPartidaEm: '2026-10-03', calculadoEm: '2026-10-10T18:00:00.000Z', criadoEm: '2026-10-02T15:00:00.000Z', premioCentavos: 300_000 }),
  torneio({ id: 2, nome: 'Torneio de setembro', status: 'calculado', primeiraPartidaEm: '2026-09-05', calculadoEm: '2026-10-15T13:00:00.000Z', criadoEm: '2026-09-20T15:00:00.000Z', premioCentavos: 1_000_000 }),
  torneio({ id: 1, nome: 'Desafio de setembro', modoDivisao: 'kills', status: 'calculado', primeiraPartidaEm: '2026-09-12', calculadoEm: '2026-09-28T20:00:00.000Z', criadoEm: '2026-09-10T15:00:00.000Z', premioCentavos: 500_000 }),
];

async function montar(lista: ResumoTorneio[] = TORNEIOS) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(lista), { status: 200, headers: { 'content-type': 'application/json' } })));
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  const pagina = mount(PaginaTorneios, { global: { plugins: [roteador] } });
  await flushPromises();
  return pagina;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T15:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const nomesDe = (el: Pick<VueWrapper, 'findAll'>) => el.findAll('article').map((c) => c.find('a').text());
const emAndamento = (pagina: VueWrapper) => pagina.find('section[aria-labelledby="t-em-andamento"]');
const grupos = (pagina: VueWrapper) => pagina.findAll('details.grupo-do-mes');
const grupo = (pagina: VueWrapper, rotulo: string) => grupos(pagina).find((d) => d.find('.nome-do-mes').text() === rotulo)!;
const resumo = (pagina: VueWrapper) => pagina.find('[aria-label="Resumo"]').text();
const escolherMes = (pagina: VueWrapper, mes: string) => pagina.find('select#filtro-mes').setValue(mes);
const divisao = (pagina: VueWrapper, rotulo: string) => pagina.find('[role="group"][aria-label="Divisão"]').findAll('button').find((b) => b.text() === rotulo)!;

describe('lista agrupada por mês', () => {
  it('"Em andamento" no topo, de qualquer mês (o de agosto não some na virada do mês)', async () => {
    const pagina = await montar();
    expect(emAndamento(pagina).find('h2').text()).toBe('Em andamento');
    expect(nomesDe(emAndamento(pagina))).toEqual(['Torneio de outubro', 'Copa de Primavera']);
  });

  it('abaixo, um grupo por mês da primeira partida, do mais recente para o mais antigo', async () => {
    const pagina = await montar();
    expect(grupos(pagina).map((d) => [d.find('.nome-do-mes').text(), nomesDe(d)])).toEqual([
      ['Outubro de 2026', ['Copa relâmpago']],
      // setembro foi calculado em outubro, mas as partidas foram em setembro
      ['Setembro de 2026', ['Torneio de setembro', 'Desafio de setembro']],
    ]);
  });

  it('o mês atual aberto; o anterior recolhido, mostrando "N torneios · R$ total"', async () => {
    const pagina = await montar();
    expect(grupo(pagina, 'Outubro de 2026').attributes('open')).toBeDefined();
    const setembro = grupo(pagina, 'Setembro de 2026');
    expect(setembro.attributes('open')).toBeUndefined();
    expect(setembro.find('summary').text()).toContain('2 torneios · R$ 15.000,00');
  });

  it('cada torneio mostra a data de criação, o prêmio, a divisão, as partidas e a situação', async () => {
    const pagina = await montar();
    const [outubro, primavera] = emAndamento(pagina).findAll('article').map((c) => c.text());
    expect(outubro).toContain('Criado em 13/10/2026');
    expect(outubro).toContain('R$ 12.000,00');
    expect(outubro).toContain('Sem planilha');
    expect(outubro).toContain('Aguardando a planilha');
    expect(primavera).toContain('Divisão por kills');
    expect(primavera).toContain('15 partidas');
  });
});

describe('resumo', () => {
  it('quantos estão em andamento e, com "Todos os meses", o total geral dos prêmios calculados', async () => {
    const pagina = await montar();
    expect(resumo(pagina)).toMatch(/Em andamento\s*2/);
    expect(resumo(pagina)).toMatch(/Prêmios calculados\s*R\$ 18\.000,00/);
  });

  it('com um mês escolhido, o total do mês do torneio, igual ao do grupo (o setembro calculado em outubro conta em setembro)', async () => {
    const pagina = await montar();
    await escolherMes(pagina, '2026-09');
    expect(resumo(pagina)).toMatch(/Prêmios calculados em setembro\s*R\$ 15\.000,00/);
    expect(grupo(pagina, 'Setembro de 2026').find('summary').text()).toContain('R$ 15.000,00');
    await escolherMes(pagina, '2026-10');
    expect(resumo(pagina)).toMatch(/Prêmios calculados em outubro\s*R\$ 3\.000,00/);
    expect(grupo(pagina, 'Outubro de 2026').find('summary').text()).toContain('R$ 3.000,00');
  });
});

describe('filtros', () => {
  it('situação: todos, em andamento e calculados', async () => {
    const pagina = await montar();
    const filtro = (rotulo: string) => pagina.findAll('[role="tab"]').find((b) => b.text().startsWith(rotulo))!;
    expect(filtro('Todos').attributes('aria-selected')).toBe('true');

    await filtro('Calculados').trigger('click');
    expect(emAndamento(pagina).exists()).toBe(false);
    expect(grupos(pagina).flatMap((d) => nomesDe(d))).toEqual(['Copa relâmpago', 'Torneio de setembro', 'Desafio de setembro']);

    await filtro('Em andamento').trigger('click');
    expect(nomesDe(emAndamento(pagina))).toEqual(['Torneio de outubro', 'Copa de Primavera']);
    expect(grupos(pagina)).toHaveLength(0);
  });

  it('mês: o seletor tem "Todos os meses" e os meses, com rótulo; escolher um mês mostra só ele, aberto', async () => {
    const pagina = await montar();
    const seletor = pagina.find('select#filtro-mes');
    expect(pagina.find('label[for="filtro-mes"]').text()).toBe('Mês');
    expect(seletor.findAll('option').map((o) => o.text())).toEqual(['Todos os meses', 'Outubro de 2026', 'Setembro de 2026', 'Agosto de 2026']);

    await escolherMes(pagina, '2026-09');
    expect(emAndamento(pagina).exists()).toBe(false);
    expect(grupos(pagina).map((d) => d.find('.nome-do-mes').text())).toEqual(['Setembro de 2026']);
    expect(grupo(pagina, 'Setembro de 2026').attributes('open')).toBeDefined();

    // o torneio de agosto ainda em andamento aparece no mês dele
    await escolherMes(pagina, '2026-08');
    expect(nomesDe(emAndamento(pagina))).toEqual(['Copa de Primavera']);
  });

  it('divisão: todas, minutos e kills', async () => {
    const pagina = await montar();
    expect(divisao(pagina, 'Todas').attributes('aria-pressed')).toBe('true');
    await divisao(pagina, 'Kills').trigger('click');
    expect(divisao(pagina, 'Kills').attributes('aria-pressed')).toBe('true');
    expect(nomesDe(emAndamento(pagina))).toEqual(['Copa de Primavera']);
    expect(grupos(pagina).flatMap((d) => nomesDe(d))).toEqual(['Desafio de setembro']);

    await divisao(pagina, 'Minutos').trigger('click');
    expect(grupos(pagina).flatMap((d) => nomesDe(d))).toEqual(['Copa relâmpago', 'Torneio de setembro']);
  });

  it('busca pelo nome, sem diferenciar maiúsculas e acentos, abrindo o mês recolhido onde está o torneio', async () => {
    const pagina = await montar();
    await pagina.find('input[type="search"]').setValue('DESAFÍO');
    expect(grupos(pagina).map((d) => [d.find('.nome-do-mes').text(), nomesDe(d)])).toEqual([['Setembro de 2026', ['Desafio de setembro']]]);
    expect(grupo(pagina, 'Setembro de 2026').attributes('open')).toBeDefined();

    await pagina.find('input[type="search"]').setValue('não existe');
    expect(pagina.findAll('article')).toHaveLength(0);
    expect(pagina.text()).toContain('Nenhum torneio encontrado.');
  });
});

it('sem nenhum torneio: convida a criar o primeiro', async () => {
  const pagina = await montar([]);
  expect(pagina.text()).toContain('Nenhum torneio ainda');
});
