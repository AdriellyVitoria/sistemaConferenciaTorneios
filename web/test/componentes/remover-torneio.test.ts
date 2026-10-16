import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from '../../src/App.vue';
import PaginaTorneios from '../../src/paginas/PaginaTorneios.vue';
import { rotas } from '../../src/roteador';
import type { ResumoTorneio } from '../../src/servicos/api';
import { criarApiFalsa } from './api-falsa';

const montadas: VueWrapper[] = [];
afterEach(() => {
  for (const p of montadas.splice(0)) p.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const dialogo = () => [...document.querySelectorAll('dialog')].find((d) => d.textContent?.includes('não pode ser desfeito'))! as HTMLDialogElement;
const botaoDoDialogo = (texto: string) => [...dialogo().querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)! as HTMLButtonElement;
const clicar = async (botao: HTMLElement) => {
  botao.click();
  await flushPromises();
};

describe('"Remover" no cartão da lista', () => {
  function torneio(extra: Partial<ResumoTorneio>): ResumoTorneio {
    return {
      id: 1, nome: 'Torneio', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos', status: 'importado',
      calculadoEm: null, planilhaArquivo: 'torneio.csv', planilhaImportadaEm: '2026-10-14T13:00:00.000Z', planilhaConvertidaDeWindows1252: false,
      criadoEm: '2026-10-14T13:00:00.000Z', quantidadeDePartidas: 15, primeiraPartidaEm: '2026-10-03', ...extra,
    };
  }
  const TORNEIOS = [
    torneio({ id: 2, nome: 'Teste 4c', status: 'importado' }),
    torneio({ id: 1, nome: 'Torneio de setembro', status: 'calculado', calculadoEm: '2026-10-15T13:00:00.000Z', primeiraPartidaEm: '2026-09-05' }),
  ];

  let pedidos: string[] = [];
  async function montar({ removerResponde = 204 } = {}) {
    pedidos = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, opcoes: RequestInit = {}) => {
      const metodo = (opcoes.method ?? 'GET').toUpperCase();
      pedidos.push(`${metodo} ${url}`);
      if (metodo === 'DELETE') {
        return removerResponde === 204
          ? new Response(null, { status: 204 })
          : new Response(JSON.stringify({ erro: 'Torneio calculado não pode ser removido: o resultado é o registro do pagamento.' }), { status: 409, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify(TORNEIOS), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
    const pagina = mount(PaginaTorneios, { global: { plugins: [roteador] }, attachTo: document.body });
    montadas.push(pagina);
    await flushPromises();
    return pagina;
  }
  const cartao = (pagina: VueWrapper, nome: string) => pagina.findAll('article').find((a) => a.find('a').text() === nome);
  const remover = (pagina: VueWrapper, nome: string) => cartao(pagina, nome)!.findAll('button').find((b) => b.text() === 'Remover');

  it('só no torneio não calculado; no calculado, o botão não existe (não fica só desabilitado)', async () => {
    const pagina = await montar();
    expect(remover(pagina, 'Teste 4c')).toBeDefined();
    expect(remover(pagina, 'Teste 4c')!.attributes('aria-label')).toBe('Remover o torneio Teste 4c');
    expect(remover(pagina, 'Torneio de setembro')).toBeUndefined();
    expect(cartao(pagina, 'Torneio de setembro')!.findAll('button')).toHaveLength(0);
  });

  it('o modal: o nome, o que será apagado, foco no "Cancelar", e um rótulo só dele', async () => {
    const pagina = await montar();
    await clicar(remover(pagina, 'Teste 4c')!.element);
    expect(dialogo().open).toBe(true);
    expect(dialogo().textContent).toContain('Remover o torneio “Teste 4c”?');
    expect(dialogo().textContent).toContain('A planilha, a conferência e os Cientes serão apagados. Isso não pode ser desfeito.');
    expect(document.activeElement?.textContent?.trim()).toBe('Cancelar');
    expect([...dialogo().querySelectorAll('.acoes button')].map((b) => b.textContent?.trim())).toEqual(['Cancelar', 'Remover torneio']);
    const idDoTitulo = dialogo().getAttribute('aria-labelledby')!;
    expect(document.getElementById(idDoTitulo)!.textContent).toBe('Remover o torneio “Teste 4c”?');
  });

  it('"Cancelar" e Esc fecham sem remover', async () => {
    const pagina = await montar();
    await clicar(remover(pagina, 'Teste 4c')!.element);
    await clicar(botaoDoDialogo('Cancelar'));
    expect(dialogo().open).toBe(false);

    await clicar(remover(pagina, 'Teste 4c')!.element);
    dialogo().dispatchEvent(new Event('cancel', { cancelable: true }));
    await flushPromises();
    expect(dialogo().open).toBe(false);
    expect(pedidos.filter((p) => p.startsWith('DELETE'))).toEqual([]);
  });

  it('confirmar: remove, o cartão some, aparece "Torneio removido" (anunciado) e o foco volta para a lista', async () => {
    const pagina = await montar();
    await clicar(remover(pagina, 'Teste 4c')!.element);
    await clicar(botaoDoDialogo('Remover torneio'));

    expect(pedidos.filter((p) => p.startsWith('DELETE'))).toEqual(['DELETE /api/torneios/2']);
    expect(cartao(pagina, 'Teste 4c')).toBeUndefined();
    const aviso = pagina.find('[role="status"].aviso-removido');
    expect(aviso.text()).toBe('Torneio removido.');
    expect(document.activeElement).toBe(aviso.element);
  });

  it('clique duplo no "Remover torneio": um pedido só', async () => {
    const pagina = await montar();
    await clicar(remover(pagina, 'Teste 4c')!.element);
    botaoDoDialogo('Remover torneio').click();
    botaoDoDialogo('Remover torneio').click();
    await flushPromises();
    expect(pedidos.filter((p) => p.startsWith('DELETE'))).toHaveLength(1);
  });

  it('409 (foi calculado em outra aba): mostra a frase da API no modal, e o torneio continua na lista', async () => {
    const pagina = await montar({ removerResponde: 409 });
    await clicar(remover(pagina, 'Teste 4c')!.element);
    await clicar(botaoDoDialogo('Remover torneio'));
    expect(dialogo().querySelector('[role="alert"]')!.textContent).toBe('Torneio calculado não pode ser removido: o resultado é o registro do pagamento.');
    expect(cartao(pagina, 'Teste 4c')).toBeDefined();
  });
});

describe('"Remover torneio" no topo da página do torneio', () => {
  async function abrir(opcoes: { calculado?: boolean } = {}) {
    const api = criarApiFalsa(opcoes);
    const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
    await roteador.push('/torneios/1');
    await roteador.isReady();
    const app = mount(App, { global: { plugins: [roteador] }, attachTo: document.body });
    montadas.push(app);
    await flushPromises();
    return { app, api, roteador };
  }
  const botaoRemover = (app: VueWrapper) => app.findAll('button').find((b) => b.text() === 'Remover torneio' && !b.element.closest('dialog'));

  it('só quando não calculado; no calculado, o botão não existe', async () => {
    const naoCalculado = await abrir();
    expect(botaoRemover(naoCalculado.app)).toBeDefined();
    naoCalculado.app.unmount();
    montadas.splice(0);
    document.body.innerHTML = '';

    const calculado = await abrir({ calculado: true });
    expect(botaoRemover(calculado.app)).toBeUndefined();
  });

  it('confirmar: remove e volta para a lista, com o aviso "Torneio removido"', async () => {
    const { app, api, roteador } = await abrir();
    await clicar(botaoRemover(app)!.element);
    expect(dialogo().textContent).toContain('Remover o torneio “Torneio de setembro”?');
    expect(document.activeElement?.textContent?.trim()).toBe('Cancelar');
    await clicar(botaoDoDialogo('Remover torneio'));

    expect(api.estado.pedidos).toContain('DELETE /api/torneios/1');
    expect(roteador.currentRoute.value.path).toBe('/');
    expect(app.find('[role="status"].aviso-removido').text()).toBe('Torneio removido.');
    expect(app.text()).toContain('Nenhum torneio ainda');
  });
});
