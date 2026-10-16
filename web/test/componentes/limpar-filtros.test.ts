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

const TORNEIOS = [
  torneio({ id: 3, nome: 'Copa relâmpago', status: 'calculado', primeiraPartidaEm: '2026-10-03', calculadoEm: '2026-10-10T18:00:00.000Z' }),
  torneio({ id: 2, nome: 'Torneio de setembro', status: 'calculado', primeiraPartidaEm: '2026-09-05', calculadoEm: '2026-10-15T13:00:00.000Z' }),
  torneio({ id: 1, nome: 'Desafio de setembro', modoDivisao: 'kills', status: 'importado', primeiraPartidaEm: '2026-09-12' }),
];

let pagina: VueWrapper;

async function montar() {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(TORNEIOS), { status: 200, headers: { 'content-type': 'application/json' } })));
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  pagina = mount(PaginaTorneios, { global: { plugins: [roteador] }, attachTo: document.body });
  await flushPromises();
  return pagina;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T15:00:00.000Z'));
});
afterEach(() => {
  pagina?.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const botaoLimpar = (p: VueWrapper) => p.findAll('button').find((b) => b.text() === 'Limpar filtros');
const situacao = (p: VueWrapper, rotulo: string) => p.find('[role="tablist"]').findAll('button').find((b) => b.text().startsWith(rotulo))!;
const divisao = (p: VueWrapper, rotulo: string) => p.find('[role="group"][aria-label="Divisão"]').findAll('button').find((b) => b.text() === rotulo)!;
const cartoes = (p: VueWrapper) => p.findAll('article').length;

describe('"Limpar filtros"', () => {
  it('fica escondido quando todos os filtros estão no padrão da tela', async () => {
    await montar();
    expect(botaoLimpar(pagina)).toBeUndefined();
  });

  it('aparece com qualquer um dos quatro filtros fora do padrão, e some quando ele volta', async () => {
    await montar();

    await situacao(pagina, 'Calculados').trigger('click');
    expect(botaoLimpar(pagina)).toBeDefined();
    await situacao(pagina, 'Todos').trigger('click');
    expect(botaoLimpar(pagina)).toBeUndefined();

    await divisao(pagina, 'Kills').trigger('click');
    expect(botaoLimpar(pagina)).toBeDefined();
    await divisao(pagina, 'Todas').trigger('click');
    expect(botaoLimpar(pagina)).toBeUndefined();

    await pagina.find('select#filtro-mes').setValue('2026-09');
    expect(botaoLimpar(pagina)).toBeDefined();
    await pagina.find('select#filtro-mes').setValue('todos');
    expect(botaoLimpar(pagina)).toBeUndefined();

    await pagina.find('input#busca-torneio').setValue('copa');
    expect(botaoLimpar(pagina)).toBeDefined();
    await pagina.find('input#busca-torneio').setValue('');
    expect(botaoLimpar(pagina)).toBeUndefined();
  });

  it('limpa todos de uma vez, mostra todos os torneios e anuncia quantos aparecem', async () => {
    await montar();
    await situacao(pagina, 'Calculados').trigger('click');
    await divisao(pagina, 'Minutos').trigger('click');
    await pagina.find('select#filtro-mes').setValue('2026-09');
    await pagina.find('input#busca-torneio').setValue('setembro');
    expect(cartoes(pagina)).toBe(1);

    await botaoLimpar(pagina)!.trigger('click');
    await flushPromises();

    expect(situacao(pagina, 'Todos').attributes('aria-selected')).toBe('true');
    expect(divisao(pagina, 'Todas').attributes('aria-pressed')).toBe('true');
    expect((pagina.find('select#filtro-mes').element as HTMLSelectElement).value).toBe('todos');
    expect((pagina.find('input#busca-torneio').element as HTMLInputElement).value).toBe('');
    expect(cartoes(pagina)).toBe(3);
    expect(botaoLimpar(pagina)).toBeUndefined();
    expect(pagina.find('[role="status"].anuncio-dos-filtros').text()).toBe('Filtros limpos: 3 torneios.');
  });

  it('o foco vai para o primeiro filtro, porque o botão some', async () => {
    await montar();
    await pagina.find('input#busca-torneio').setValue('copa');
    const botao = botaoLimpar(pagina)!;
    (botao.element as HTMLButtonElement).focus();

    await botao.trigger('click');
    await flushPromises();

    expect(document.activeElement).toBe(situacao(pagina, 'Todos').element);
  });

  it('fica junto dos filtros', async () => {
    await montar();
    await pagina.find('input#busca-torneio').setValue('copa');
    expect(pagina.find('.controles').findAll('button').some((b) => b.text() === 'Limpar filtros')).toBe(true);
  });
});
