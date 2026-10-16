import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import PaginaTorneio from '../../src/paginas/PaginaTorneio.vue';
import { rotas } from '../../src/roteador';
import { criarApiFalsa, type OpcoesApiFalsa } from './api-falsa';
import { textoDe } from '../ajudantes/espacos';

const montadas: VueWrapper[] = [];
afterEach(() => {
  for (const p of montadas.splice(0)) p.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

async function montar(opcoes: OpcoesApiFalsa & { pronto?: boolean } = {}) {
  const api = criarApiFalsa(opcoes);
  if (opcoes.pronto) {
    api.pendencias.splice(api.pendencias.findIndex((p) => p.bloqueante), 1);
    for (const p of api.pendencias) Object.assign(p, { ciente: true, cienteEm: '2026-10-15T12:51:00.000Z' });
  }
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  const pagina = mount(PaginaTorneio, { props: { id: 1 }, global: { plugins: [roteador] }, attachTo: document.body });
  montadas.push(pagina);
  await flushPromises();
  return { pagina, api };
}

const aviso = (pagina: VueWrapper) => pagina.find('[aria-label="Situação do cálculo"]');
const botaoCalcular = (pagina: VueWrapper) => aviso(pagina).findAll('button').find((b) => textoDe(b) === 'Calcular prêmios');
const dialogo = (pagina: VueWrapper) => pagina.findAll('dialog').find((d) => textoDe(d).includes('O cálculo é definitivo'))!;
const botaoDoDialogo = (pagina: VueWrapper, texto: string) => dialogo(pagina).findAll('button').find((b) => textoDe(b) === texto)!;
const pedidosDeCalculo = (api: ReturnType<typeof criarApiFalsa>) => api.estado.pedidos.filter((p) => p === 'POST /api/torneios/1/calculo').length;

async function abrirModal(pagina: VueWrapper) {
  await botaoCalcular(pagina)!.trigger('click');
  await flushPromises();
}

describe('botão "Calcular prêmios"', () => {
  it('desabilitado quando não pode calcular, explicando o porquê', async () => {
    const { pagina } = await montar();
    const botao = botaoCalcular(pagina)!;
    expect(botao.attributes('disabled')).toBeDefined();
    const explicacao = aviso(pagina).find(`#${botao.attributes('aria-describedby')}`);
    expect(textoDe(explicacao)).toContain('Falta para calcular');
  });

  it('habilitado quando pode calcular', async () => {
    const { pagina } = await montar({ pronto: true });
    expect(textoDe(aviso(pagina))).toContain('Tudo conferido. Pronto para calcular.');
    expect(botaoCalcular(pagina)!.attributes('disabled')).toBeUndefined();
  });
});

describe('modal de confirmação (D22)', () => {
  it('mostra o resumo do que vai ser calculado e o aviso de que é definitivo', async () => {
    const { pagina } = await montar({ pronto: true });
    await abrirModal(pagina);
    const texto = textoDe(dialogo(pagina));
    expect(dialogo(pagina).attributes('open')).toBeDefined();
    for (const parte of ['R$ 10.000,00', '1º 50% · 2º 30% · 3º 20%', 'Divisão por minutos jogados', '5 partidas', '3 Cientes']) {
      expect(texto).toContain(parte);
    }
    expect(texto).toContain('O cálculo é definitivo. Depois dele não dá para dar Ciente, corrigir ID nem trocar a planilha.');
    expect(dialogo(pagina).findAll('.acoes button').map((b) => textoDe(b))).toEqual(['Voltar', 'Calcular prêmios']);
  });

  it('o modal tem rótulo: o título dele, com um id que é só dele', async () => {
    const { pagina } = await montar({ pronto: true });
    await abrirModal(pagina);
    const idDoTitulo = dialogo(pagina).attributes('aria-labelledby')!;
    expect(document.querySelectorAll(`#${CSS.escape(idDoTitulo)}`)).toHaveLength(1);
    expect(document.getElementById(idDoTitulo)!.textContent).toBe('Calcular os prêmios?');
  });

  it('o foco começa no "Voltar", a opção segura', async () => {
    const { pagina } = await montar({ pronto: true });
    await abrirModal(pagina);
    expect(document.activeElement?.textContent?.trim()).toBe('Voltar');
  });

  it('"Voltar" e Esc fecham sem calcular', async () => {
    const { pagina, api } = await montar({ pronto: true });
    await abrirModal(pagina);
    await botaoDoDialogo(pagina, 'Voltar').trigger('click');
    expect(dialogo(pagina).attributes('open')).toBeUndefined();

    await abrirModal(pagina);
    await dialogo(pagina).trigger('cancel');
    expect(dialogo(pagina).attributes('open')).toBeUndefined();
    expect(pedidosDeCalculo(api)).toBe(0);
  });
});

describe('calcular', () => {
  it('clique duplo gera um pedido só', async () => {
    const { pagina, api } = await montar({ pronto: true });
    await abrirModal(pagina);
    const confirmar = botaoDoDialogo(pagina, 'Calcular prêmios');
    await Promise.all([confirmar.trigger('click'), confirmar.trigger('click')]);
    await flushPromises();
    expect(pedidosDeCalculo(api)).toBe(1);
  });

  it('enquanto o pedido está em andamento, o botão fica desabilitado', async () => {
    const { pagina } = await montar({ pronto: true });
    await abrirModal(pagina);
    await botaoDoDialogo(pagina, 'Calcular prêmios').trigger('click');
    expect(botaoCalcular(pagina)!.attributes('disabled')).toBeDefined();
    expect(textoDe(botaoCalcular(pagina)!)).toBe('Calcular prêmios');
    await flushPromises();
  });

  it('409 (algo mudou entre a tela e o clique): mostra a mensagem da API e recarrega, sem perder a tela', async () => {
    const { pagina, api } = await montar({ pronto: true, recusarCalculo: true });
    const leituras = () => api.estado.pedidos.filter((p) => p === 'GET /api/torneios/1').length;
    const antes = leituras();
    await abrirModal(pagina);
    await botaoDoDialogo(pagina, 'Calcular prêmios').trigger('click');
    await flushPromises();

    expect(textoDe(pagina.find('[role="alert"]'))).toContain('Ainda não dá para calcular: 1 sem Ciente.');
    expect(leituras()).toBeGreaterThan(antes);
    expect(textoDe(pagina.find('h1'))).toBe('Torneio de setembro');
    expect(textoDe(aviso(pagina))).toContain('1 sem Ciente');
  });

  it('sucesso: o aviso mostra a data do cálculo e o link "Ver resultado"', async () => {
    const { pagina } = await montar({ pronto: true });
    await abrirModal(pagina);
    await botaoDoDialogo(pagina, 'Calcular prêmios').trigger('click');
    await flushPromises();

    expect(textoDe(aviso(pagina))).toMatch(/Calculado em \d{2}\/10\/2026 às \d{2}:\d{2}\./);
    const link = aviso(pagina).findAll('a').find((a) => textoDe(a) === 'Ver resultado')!;
    expect(link.attributes('href')).toBe('/torneios/1/resultado');
    expect(botaoCalcular(pagina)).toBeUndefined();
  });
});
