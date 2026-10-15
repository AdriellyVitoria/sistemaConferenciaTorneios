// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { rotas } from '../../src/roteador';
import PaginaTorneios from '../../src/paginas/PaginaTorneios.vue';
import type { ResumoTorneio } from '../../src/servicos/api';

function torneio(extra: Partial<ResumoTorneio>): ResumoTorneio {
  return {
    id: 1,
    nome: 'Torneio',
    premioCentavos: 1_000_000,
    percentuais: [50, 30, 20],
    modoDivisao: 'minutos',
    status: 'importado',
    calculadoEm: null,
    planilhaArquivo: 'torneio.csv',
    planilhaImportadaEm: '2026-10-14T13:00:00.000Z',
    planilhaConvertidaDeWindows1252: false,
    criadoEm: '2026-10-14T13:00:00.000Z',
    quantidadeDePartidas: 15,
    ...extra,
  };
}

const TORNEIOS = [
  torneio({ id: 3, nome: 'Torneio de outubro', status: 'criado', planilhaArquivo: null, quantidadeDePartidas: 0, criadoEm: '2026-10-13T15:00:00.000Z', premioCentavos: 1_200_000 }),
  torneio({ id: 2, nome: 'Copa de Primavera', modoDivisao: 'kills', criadoEm: '2026-10-12T15:00:00.000Z', premioCentavos: 500_000 }),
  torneio({ id: 1, nome: 'Torneio de setembro', status: 'calculado', criadoEm: '2026-09-20T15:00:00.000Z', premioCentavos: 1_000_000 }),
];

async function montar(lista: ResumoTorneio[] = TORNEIOS) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(lista), { status: 200, headers: { 'content-type': 'application/json' } })));
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  const pagina = mount(PaginaTorneios, { global: { plugins: [roteador] } });
  await flushPromises();
  return pagina;
}

const cartoes = (pagina: Awaited<ReturnType<typeof montar>>) => pagina.findAll('article');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lista de torneios', () => {
  it('cada torneio mostra a data de criação', async () => {
    const pagina = await montar();
    const textos = cartoes(pagina).map((c) => c.text());
    expect(textos[0]).toContain('Criado em 13/10/2026');
    expect(textos[1]).toContain('Criado em 12/10/2026');
    expect(textos[2]).toContain('Criado em 20/09/2026');
  });

  it('cada torneio mostra o prêmio, a divisão, as partidas e a situação', async () => {
    const [outubro, primavera] = cartoes(await montar()).map((c) => c.text());
    expect(outubro).toContain('R$ 12.000,00');
    expect(outubro).toContain('Sem planilha');
    expect(outubro).toContain('Aguardando a planilha');
    expect(primavera).toContain('Divisão por kills');
    expect(primavera).toContain('15 partidas');
  });

  it('resumo: quantos estão em andamento e o total dos prêmios calculados', async () => {
    const resumo = (await montar()).find('[aria-label="Resumo"]').text();
    expect(resumo).toContain('Em andamento');
    expect(resumo).toMatch(/Em andamento\s*2/);
    expect(resumo).toMatch(/Prêmios calculados\s*R\$ 10\.000,00/);
  });

  it('filtros: todos, em andamento e calculados', async () => {
    const pagina = await montar();
    const filtro = (rotulo: string) => pagina.findAll('[role="tab"]').find((b) => b.text().startsWith(rotulo))!;
    expect(filtro('Todos').attributes('aria-selected')).toBe('true');

    await filtro('Calculados').trigger('click');
    expect(cartoes(pagina).map((c) => c.find('a').text())).toEqual(['Torneio de setembro']);
    expect(filtro('Calculados').attributes('aria-selected')).toBe('true');

    await filtro('Em andamento').trigger('click');
    expect(cartoes(pagina).map((c) => c.find('a').text())).toEqual(['Torneio de outubro', 'Copa de Primavera']);
  });

  it('busca pelo nome, sem diferenciar maiúsculas e acentos', async () => {
    const pagina = await montar();
    await pagina.find('input[type="search"]').setValue('PRIMAVÉRA');
    expect(cartoes(pagina).map((c) => c.find('a').text())).toEqual(['Copa de Primavera']);

    await pagina.find('input[type="search"]').setValue('não existe');
    expect(cartoes(pagina)).toHaveLength(0);
    expect(pagina.text()).toContain('Nenhum torneio encontrado.');
  });

  it('sem nenhum torneio: convida a criar o primeiro', async () => {
    const pagina = await montar([]);
    expect(pagina.text()).toContain('Nenhum torneio ainda');
  });
});
