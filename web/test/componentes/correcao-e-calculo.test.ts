// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import PaginaTorneio from '../../src/paginas/PaginaTorneio.vue';
import { rotas } from '../../src/roteador';
import { criarApiFalsa, type OpcoesApiFalsa } from './api-falsa';

const montadas: VueWrapper[] = [];
afterEach(() => {
  // desmontar desliga a sondagem: nenhum timer passa de um teste para o outro
  for (const p of montadas.splice(0)) p.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

async function montar(opcoes: OpcoesApiFalsa = {}, antes?: (api: ReturnType<typeof criarApiFalsa>) => void) {
  const api = criarApiFalsa(opcoes);
  antes?.(api);
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  const pagina = mount(PaginaTorneio, { props: { id: 1 }, global: { plugins: [roteador] }, attachTo: document.body });
  montadas.push(pagina);
  await flushPromises();
  return { pagina, api };
}

const aba = (pagina: VueWrapper, rotulo: string) => pagina.findAll('[role="tab"]').find((t) => t.text().startsWith(rotulo))!;
const bloqueante = (pagina: VueWrapper) => pagina.find('article.pendencia.bloqueante');
const botao = (raiz: { findAll: VueWrapper['findAll'] }, texto: string) => raiz.findAll('button').find((b) => b.text() === texto);

async function corrigirPara(pagina: VueWrapper, texto: string) {
  await botao(bloqueante(pagina), 'Corrigir ID')!.trigger('click');
  await bloqueante(pagina).find('input').setValue(texto);
  await bloqueante(pagina).find('form').trigger('submit');
  await flushPromises();
}

describe('correção do ID no cartão da pendência bloqueante (D5, D16)', () => {
  it('"Corrigir ID" abre um campo com o ID atual, com rótulo', async () => {
    const { pagina } = await montar();
    expect(bloqueante(pagina).find('input').exists()).toBe(false);

    await botao(bloqueante(pagina), 'Corrigir ID')!.trigger('click');
    const campo = bloqueante(pagina).find('input');
    expect((campo.element as HTMLInputElement).value).toBe('#52214');
    const rotulo = bloqueante(pagina).find(`label[for="${campo.attributes('id')}"]`);
    expect(rotulo.text()).toBe('ID correto da partida');
  });

  it('cancelar fecha o campo sem enviar nada', async () => {
    const { pagina, api } = await montar();
    await botao(bloqueante(pagina), 'Corrigir ID')!.trigger('click');
    await botao(bloqueante(pagina), 'Cancelar')!.trigger('click');
    expect(bloqueante(pagina).find('input').exists()).toBe(false);
    expect(api.estado.pedidos.some((p) => p.startsWith('PUT /api/torneios/1/partidas/'))).toBe(false);
  });

  it('com sucesso: a partida vai para "Aguardando o site" e a atualização a cada 5 s volta a rodar', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const { pagina, api } = await montar();
    const leiturasDoTorneio = () => api.estado.pedidos.filter((p) => p === 'GET /api/torneios/1').length;

    // sem nada aguardando, a sondagem está parada
    const antes = leiturasDoTorneio();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(leiturasDoTorneio()).toBe(antes);

    await corrigirPara(pagina, '52241');
    expect(api.estado.pedidos).toContain('PUT /api/torneios/1/partidas/5/id-partida');
    expect(bloqueante(pagina).exists()).toBe(false);
    expect(pagina.find('[role="status"].aviso').text()).toContain('ID corrigido');
    expect(aba(pagina, 'Aguardando o site').find('.contador').text()).toBe('1');

    await aba(pagina, 'Aguardando o site').trigger('click');
    expect(pagina.find('#painel-aguardando').text()).toContain('#52214 → #52241 (corrigido)');

    // a sondagem voltou: uma leitura nova a cada 5 s
    const depois = leiturasDoTorneio();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(leiturasDoTorneio()).toBe(depois + 1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(leiturasDoTorneio()).toBe(depois + 2);
  });

  it.each([
    ['formato inválido (400)', '#52a41', 'O ID da partida precisa ter só números, como #45659. Veio "#52a41".'],
    ['igual ao atual (400)', '#52214', 'Esse já é o ID da partida.'],
    ['já existe no torneio (409)', '#45659', 'O ID #45659 já é de outra partida deste torneio. Confira o ID: cada partida tem o seu.'],
  ])('%s: a mensagem da API aparece junto do campo, e nada muda', async (_caso, texto, mensagem) => {
    const { pagina } = await montar();
    await corrigirPara(pagina, texto);

    const campo = bloqueante(pagina).find('input');
    const erro = bloqueante(pagina).find('.mensagem-erro');
    expect(erro.text()).toBe(mensagem);
    expect(campo.attributes('aria-invalid')).toBe('true');
    expect(campo.attributes('aria-describedby')).toContain(erro.attributes('id'));
    expect(aba(pagina, 'Aguardando o site').find('.contador').text()).toBe('0');
  });
});

describe('ID corrigido exibido', () => {
  it('onde o ID aparece, mostra "planilha → atual (corrigido)"', async () => {
    const { pagina } = await montar({}, (api) => {
      api.partidas.find((p) => p.idPartida === '#40923')!.idPartidaPlanilha = '#40932';
      api.partidas.find((p) => p.idPartida === '#45659')!.idPartidaPlanilha = '#45695';
    });
    // no título da pendência
    expect(pagina.text()).toContain('Partida #40932 → #40923 (corrigido) · Rodada 5 · Falcões x Panteras');
    // na aba Conferidas
    await aba(pagina, 'Conferidas').trigger('click');
    expect(pagina.find('#painel-conferidas').text()).toContain('#45695 → #45659 (corrigido)');
  });
});

describe('aviso "pronto para calcular", no topo', () => {
  const aviso = (pagina: VueWrapper) => pagina.find('[aria-label="Situação do cálculo"]');

  it('sem planilha: "Envie a planilha para começar"', async () => {
    const { pagina } = await montar({ semPlanilha: true });
    expect(aviso(pagina).text()).toContain('Envie a planilha para começar.');
  });

  it('faltando algo: as contagens, cada uma levando para a aba certa', async () => {
    const { pagina } = await montar({ aguardando: 2 });
    const texto = aviso(pagina).text();
    expect(texto).toContain('Falta para calcular');
    for (const item of ['2 aguardando o site', '1 bloqueio', '3 sem Ciente']) expect(texto).toContain(item);

    await botao(aviso(pagina), '2 aguardando o site')!.trigger('click');
    expect(aba(pagina, 'Aguardando o site').attributes('aria-selected')).toBe('true');
    await botao(aviso(pagina), '1 bloqueio')!.trigger('click');
    expect(aba(pagina, 'Pendências').attributes('aria-selected')).toBe('true');
    await aba(pagina, 'Conferidas').trigger('click');
    await botao(aviso(pagina), '3 sem Ciente')!.trigger('click');
    expect(aba(pagina, 'Pendências').attributes('aria-selected')).toBe('true');
  });

  it('só mostra o que falta: sem bloqueio, o item de bloqueio não aparece', async () => {
    const { pagina } = await montar({}, (api) => {
      api.pendencias.splice(api.pendencias.findIndex((p) => p.bloqueante), 1);
    });
    expect(aviso(pagina).text()).not.toContain('bloqueio');
    expect(aviso(pagina).text()).not.toContain('aguardando o site');
    expect(aviso(pagina).text()).toContain('3 sem Ciente');
  });

  it('pronto: "Tudo conferido. Pronto para calcular."', async () => {
    const { pagina } = await montar({ semPendencias: true });
    expect(aviso(pagina).text()).toContain('Tudo conferido. Pronto para calcular.');
  });

  it('calculado: a data do cálculo', async () => {
    const { pagina } = await montar({ calculado: true });
    expect(aviso(pagina).text()).toMatch(/Calculado em \d{2}\/10\/2026 às \d{2}:\d{2}\./);
  });
});
