// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import PaginaTorneio from '../../src/paginas/PaginaTorneio.vue';
import { rotas } from '../../src/roteador';
import { criarApiFalsa, type OpcoesApiFalsa } from './api-falsa';

const montadas: VueWrapper[] = [];
afterEach(() => {
  for (const p of montadas.splice(0)) p.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** A página do torneio; `comCiente` marca o Ciente nessas pendências antes de abrir. */
async function montar(opcoes: OpcoesApiFalsa & { comCiente?: string[]; semBloqueante?: boolean } = {}) {
  const api = criarApiFalsa(opcoes);
  for (const p of api.pendencias) {
    if (opcoes.comCiente?.includes(p.tipo)) Object.assign(p, { ciente: true, cienteEm: '2026-10-15T12:51:00.000Z' });
  }
  if (opcoes.semBloqueante) api.pendencias.splice(api.pendencias.findIndex((p) => p.bloqueante), 1);
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  const pagina = mount(PaginaTorneio, { props: { id: 1 }, global: { plugins: [roteador] }, attachTo: document.body });
  montadas.push(pagina);
  await flushPromises();
  return { pagina, api };
}

const TRES_CIENTES = ['duplicata', 'nick_diferente', 'sem_dados_planilha'];
const aba = (pagina: VueWrapper, rotulo: string) => pagina.findAll('[role="tab"]').find((t) => t.text().startsWith(rotulo))!;
const contador = (pagina: VueWrapper, rotulo: string) => aba(pagina, rotulo).find('.contador').text();
const painel = (pagina: VueWrapper) => pagina.find('#painel-conferidas');
const filtro = (pagina: VueWrapper, rotulo: string) => painel(pagina).findAll('[role="group"] button').find((b) => b.text().startsWith(rotulo))!;
const linhas = (pagina: VueWrapper) => painel(pagina).findAll('tbody tr.partida');
const idsVisiveis = (pagina: VueWrapper) => linhas(pagina).map((l) => l.find('td').text());
const botao = (raiz: { findAll: VueWrapper['findAll'] }, texto: string) => raiz.findAll('button').find((b) => b.text() === texto);
const linhaDa = (pagina: VueWrapper, idPartida: string) => linhas(pagina).find((l) => l.find('td').text() === idPartida)!;

async function abrirConferidas(pagina: VueWrapper) {
  await aba(pagina, 'Conferidas').trigger('click');
}

describe('aba Conferidas: agrupamento e dados do site', () => {
  it('partidas agrupadas por rodada, na ordem, com a data de cada rodada', async () => {
    const { pagina } = await montar({ comCiente: TRES_CIENTES });
    await abrirConferidas(pagina);
    expect(painel(pagina).findAll('th[scope="rowgroup"]').map((t) => t.text())).toEqual([
      'Rodada 1 · 05/09', 'Rodada 2 · 06/09', 'Rodada 3 · 07/09', 'Rodada 5 · 09/09',
    ]);
    expect(idsVisiveis(pagina)).toEqual(['#45659', '#46065', '#48087', '#40923']);
  });

  it('cada partida mostra ID, times, as kills de cada time e o vencedor, segundo o site', async () => {
    const { pagina } = await montar();
    await abrirConferidas(pagina);
    const celulas = linhaDa(pagina, '#45659').findAll('td').map((c) => c.text());
    expect(celulas.slice(0, 4)).toEqual(['#45659', 'Lobos × Serpentes', '61 × 41', 'Lobos']);
    expect(celulas[4]).toContain('Bateu com o site');
  });

  it('a tabela tem legenda e cabeçalhos para leitor de tela', async () => {
    const { pagina } = await montar();
    await abrirConferidas(pagina);
    expect(painel(pagina).find('caption').text()).toBe('Partidas conferidas com o site oficial');
    expect(painel(pagina).findAll('thead th[scope="col"]').map((t) => t.text())).toEqual(['Partida', 'Times', 'Kills', 'Vencedor', 'Situação']);
  });
});

describe('aba Conferidas: filtros', () => {
  it('"Todas", "Bateram com o site" e "Com Ciente", com contagem; um de cada vez', async () => {
    const { pagina } = await montar({ comCiente: TRES_CIENTES });
    await abrirConferidas(pagina);
    expect(painel(pagina).findAll('[role="group"] button').map((b) => b.text())).toEqual(['Todas · 4', 'Bateram com o site · 1', 'Com Ciente · 3']);
    expect(filtro(pagina, 'Todas').attributes('aria-pressed')).toBe('true');

    await filtro(pagina, 'Bateram').trigger('click');
    expect(idsVisiveis(pagina)).toEqual(['#45659']);
    expect(filtro(pagina, 'Bateram').attributes('aria-pressed')).toBe('true');
    expect(filtro(pagina, 'Todas').attributes('aria-pressed')).toBe('false');

    await filtro(pagina, 'Com Ciente').trigger('click');
    expect(idsVisiveis(pagina)).toEqual(['#46065', '#48087', '#40923']);
    // a rodada sem partida no filtro some
    expect(painel(pagina).findAll('th[scope="rowgroup"]').map((t) => t.text())).toEqual(['Rodada 2 · 06/09', 'Rodada 3 · 07/09', 'Rodada 5 · 09/09']);
  });

  it('nas com Ciente: qual era a diferença e a hora do Ciente', async () => {
    const { pagina } = await montar({ comCiente: TRES_CIENTES });
    await abrirConferidas(pagina);
    const situacao = linhaDa(pagina, '#48087').findAll('td')[4].text();
    expect(situacao).toContain('Conferida com Ciente');
    expect(situacao).toContain('Nick escrito diferente: xxsniperxx → xXSniperXx');
    expect(situacao).toMatch(/Ciente às \d{2}:\d{2}/);
    expect(linhaDa(pagina, '#46065').text()).toContain('Linha duplicada: Pantera_X contado uma vez');
  });
});

describe('Desfazer pela aba Conferidas', () => {
  it('Ciente dado em Pendências: a partida vai para Conferidas e lá dá para ver a diferença e desfazer', async () => {
    const { pagina, api } = await montar();
    // dá o Ciente na aba Pendências
    await aba(pagina, 'Pendências').trigger('click');
    const duplicata = pagina.findAll('article.pendencia').find((c) => c.find('.selo').text() === 'Linha duplicada')!;
    await botao(duplicata, 'Ciente')!.trigger('click');
    await flushPromises();

    await abrirConferidas(pagina);
    const linha = linhaDa(pagina, '#46065');
    const ver = botao(linha, 'Ver a diferença')!;
    expect(ver.attributes('aria-expanded')).toBe('false');
    await ver.trigger('click');
    expect(ver.attributes('aria-expanded')).toBe('true');
    const detalhe = painel(pagina).find(`#${ver.attributes('aria-controls')}`);
    expect(detalhe.find('.lado.planilha').text()).toContain('2 vezes: 42 min, 8 kills / 42 min, 8 kills');
    expect(detalhe.find('.lado.site').text()).toContain('42 min, 8 kills');

    await botao(detalhe, 'Desfazer')!.trigger('click');
    await flushPromises();
    expect(api.estado.pedidos).toContain(`DELETE /api/torneios/1/pendencias/${'b'.repeat(64)}/ciente`);
    // a partida voltou para Pendências
    expect(idsVisiveis(pagina)).not.toContain('#46065');
    expect(contador(pagina, 'Pendências')).toBe('4');
  });

  it('depois do cálculo: "Ver a diferença" continua, sem Desfazer', async () => {
    const { pagina } = await montar({ calculado: true, comCiente: TRES_CIENTES });
    await abrirConferidas(pagina);
    const ver = botao(linhaDa(pagina, '#46065'), 'Ver a diferença')!;
    await ver.trigger('click');
    const detalhe = painel(pagina).find(`#${ver.attributes('aria-controls')}`);
    expect(detalhe.find('.lado.site').exists()).toBe(true);
    expect(botao(detalhe, 'Desfazer')).toBeUndefined();
    expect(painel(pagina).text()).toContain('só para consulta');
  });
});

describe('Pendências depois do Ciente (D17: cada problema num lugar só)', () => {
  it('o cartão sai de Pendências, e o aviso tem um Desfazer para o arrependimento imediato', async () => {
    const { pagina, api } = await montar();
    await aba(pagina, 'Pendências').trigger('click');
    const cartoes = () => pagina.findAll('article.pendencia').map((c) => c.find('.selo').text());
    expect(cartoes()).toContain('Linha duplicada');

    const duplicata = pagina.findAll('article.pendencia').find((c) => c.find('.selo').text() === 'Linha duplicada')!;
    await botao(duplicata, 'Ciente')!.trigger('click');
    await flushPromises();
    expect(cartoes()).not.toContain('Linha duplicada');
    const aviso = pagina.find('#painel-pendencias [role="status"].aviso');
    expect(aviso.text()).toContain('Ciente registrado: a partida #46065 foi para Conferidas.');

    await botao(aviso, 'Desfazer')!.trigger('click');
    await flushPromises();
    expect(api.estado.pedidos).toContain(`DELETE /api/torneios/1/pendencias/${'b'.repeat(64)}/ciente`);
    expect(cartoes()).toContain('Linha duplicada');
  });

  it('com as três não bloqueantes com Ciente, Pendências mostra só a bloqueante', async () => {
    const { pagina } = await montar({ comCiente: TRES_CIENTES });
    await aba(pagina, 'Pendências').trigger('click');
    expect(pagina.find('#painel-pendencias').findAll('article.pendencia').map((c) => c.find('.selo').text())).toEqual(['Partida não encontrada no site']);
  });

  it('nada faltando, mas com Cientes: Pendências diz isso e aponta Conferidas', async () => {
    const { pagina } = await montar({ comCiente: TRES_CIENTES, semBloqueante: true });
    await aba(pagina, 'Pendências').trigger('click');
    const painelPendencias = pagina.find('#painel-pendencias');
    expect(painelPendencias.findAll('article.pendencia')).toHaveLength(0);
    expect(painelPendencias.text()).toContain('Nada faltando: as 3 pendências com Ciente estão em Conferidas.');
  });
});
