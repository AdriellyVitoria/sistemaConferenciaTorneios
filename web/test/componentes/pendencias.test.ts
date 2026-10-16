// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import PaginaTorneio from '../../src/paginas/PaginaTorneio.vue';
import { rotas } from '../../src/roteador';
import { criarApiFalsa, type OpcoesApiFalsa } from './api-falsa';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

async function montar(opcoes: OpcoesApiFalsa = {}) {
  const api = criarApiFalsa(opcoes);
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  const pagina = mount(PaginaTorneio, { props: { id: 1 }, global: { plugins: [roteador] }, attachTo: document.body });
  await flushPromises();
  return { pagina, api };
}

const aba = (pagina: VueWrapper, rotulo: string) => pagina.findAll('[role="tab"]').find((t) => t.text().startsWith(rotulo));
async function abrirPendencias(pagina: VueWrapper) {
  await aba(pagina, 'Pendências')!.trigger('click');
}
/** O cartão de uma pendência, pelo texto do selo. */
const cartao = (pagina: VueWrapper, selo: string) => pagina.findAll('article.pendencia').find((c) => c.find('.selo').text() === selo)!;
/** O diálogo do Ciente de todas, pelo título: a página tem outros (substituir planilha, calcular). */
const dialogoDoCienteDeTodas = (pagina: VueWrapper) => pagina.findAll('dialog').find((d) => d.find('h2').text().startsWith('Marcar Ciente'))!;
const botao = (raiz: VueWrapper | ReturnType<VueWrapper['find']>, texto: string) => raiz.findAll('button').find((b) => b.text() === texto);

describe('abas da página do torneio (D17)', () => {
  it('"Conferidas", "Pendências" e "Aguardando o site"; a aba provisória "Todas" saiu', async () => {
    const { pagina } = await montar();
    expect(pagina.findAll('[role="tab"]').map((t) => t.text().replace(/\s+\d+$/, ''))).toEqual(['Conferidas', 'Pendências', 'Aguardando o site']);
    expect(aba(pagina, 'Todas')).toBeUndefined();
  });

  it('a aba Pendências conta as que ainda faltam (bloqueantes e sem Ciente); Conferidas só as partidas sem nada faltando', async () => {
    const { pagina } = await montar();
    expect(aba(pagina, 'Pendências')!.find('.contador').text()).toBe('4');
    expect(aba(pagina, 'Conferidas')!.find('.contador').text()).toBe('1'); // só a #45659 bateu com o site
  });

  it('abre em Pendências quando há o que resolver', async () => {
    const { pagina } = await montar();
    expect(aba(pagina, 'Pendências')!.attributes('aria-selected')).toBe('true');
  });
});

describe('pendências', () => {
  it('bloqueantes primeiro, com o aviso de corrigir o ID e sem botão de Ciente', async () => {
    const { pagina } = await montar();
    await abrirPendencias(pagina);
    const cartoes = pagina.findAll('article.pendencia');
    expect(cartoes[0].find('.selo').text()).toBe('Partida não encontrada no site');

    const bloqueante = cartao(pagina, 'Partida não encontrada no site');
    expect(bloqueante.text()).toContain('Corrija o ID');
    expect(bloqueante.text()).toContain('#52214');
    // o único botão é o de corrigir o ID (5e): nada de Ciente nem Desfazer
    expect(bloqueante.findAll('button').map((b) => b.text())).toEqual(['Corrigir ID']);
  });

  it('não bloqueante: planilha e site lado a lado, com a partida e os times', async () => {
    const { pagina } = await montar();
    await abrirPendencias(pagina);
    const duplicata = cartao(pagina, 'Linha duplicada');
    expect(duplicata.text()).toContain('Partida #46065 · Rodada 2 · Lobos x Panteras');
    expect(duplicata.find('.lado.planilha').text()).toContain('2 vezes: 42 min, 8 kills / 42 min, 8 kills');
    expect(duplicata.find('.lado.site').text()).toContain('No site oficial · usado no cálculo');
    expect(duplicata.find('.lado.site').text()).toContain('42 min, 8 kills');
  });

  // 5f: com o Ciente, a pendência sai daqui e vai para Conferidas (D17: um lugar só); o
  // "Desfazer" fica no aviso, para o arrependimento imediato, e em Conferidas
  it('"Ciente" tira o cartão de Pendências; o "Desfazer" do aviso traz de volta; a contagem acompanha', async () => {
    const { pagina, api } = await montar();
    await abrirPendencias(pagina);

    await botao(cartao(pagina, 'Linha duplicada'), 'Ciente')!.trigger('click');
    await flushPromises();
    expect(api.estado.pedidos).toContain(`PUT /api/torneios/1/pendencias/${'b'.repeat(64)}/ciente`);
    expect(cartao(pagina, 'Linha duplicada')).toBeUndefined();
    expect(aba(pagina, 'Pendências')!.find('.contador').text()).toBe('3');

    const aviso = pagina.find('#painel-pendencias [role="status"].aviso');
    expect(botao(aviso, 'Desfazer')!.attributes('aria-label')).toBe('Desfazer o Ciente: Linha duplicada, partida #46065');
    await botao(aviso, 'Desfazer')!.trigger('click');
    await flushPromises();
    expect(api.estado.pedidos).toContain(`DELETE /api/torneios/1/pendencias/${'b'.repeat(64)}/ciente`);
    expect(botao(cartao(pagina, 'Linha duplicada'), 'Ciente')).toBeDefined();
    expect(aba(pagina, 'Pendências')!.find('.contador').text()).toBe('4');
  });

  it('os botões dizem de qual pendência são, para quem usa leitor de tela', async () => {
    const { pagina } = await montar();
    await abrirPendencias(pagina);
    expect(botao(cartao(pagina, 'Nick escrito diferente'), 'Ciente')!.attributes('aria-label')).toBe('Ciente: Nick escrito diferente, partida #48087');
  });

  it('"os dados mudaram" (404): recarrega a lista e explica', async () => {
    const { pagina, api } = await montar();
    await abrirPendencias(pagina);
    api.estado.mudarAoMarcar = 'b'.repeat(64);

    await botao(cartao(pagina, 'Linha duplicada'), 'Ciente')!.trigger('click');
    await flushPromises();

    expect(pagina.find('[role="alert"]').text()).toContain('Os dados desta pendência mudaram');
    // a lista foi lida de novo: a duplicata agora mostra o valor novo do site e continua sem Ciente
    expect(api.estado.pedidos.filter((p) => p === 'GET /api/torneios/1/pendencias').length).toBeGreaterThanOrEqual(2);
    expect(cartao(pagina, 'Linha duplicada').find('.lado.site').text()).toContain('40 min, 8 kills');
    expect(botao(cartao(pagina, 'Linha duplicada'), 'Ciente')).toBeDefined();
  });
});

describe('"Ciente de todas"', () => {
  it('o modal diz quantas serão marcadas e que as bloqueantes não entram; depois diz quantas foram', async () => {
    const { pagina, api } = await montar();
    await abrirPendencias(pagina);
    await botao(cartao(pagina, 'Linha duplicada'), 'Ciente')!.trigger('click');
    await flushPromises();

    await botao(pagina, 'Ciente de todas')!.trigger('click');
    await flushPromises();
    const dialogo = dialogoDoCienteDeTodas(pagina);
    expect(dialogo.attributes('open')).toBeDefined();
    expect(dialogo.text()).toContain('Marcar Ciente em 2 pendências?');
    expect(dialogo.text()).toContain('A pendência que pede correção do ID não entra.');
    expect(api.estado.pedidos).not.toContain('POST /api/torneios/1/pendencias/ciente-de-todas');

    await botao(dialogo, 'Marcar Ciente em 2')!.trigger('click');
    await flushPromises();
    expect(api.estado.pedidos).toContain('POST /api/torneios/1/pendencias/ciente-de-todas');
    expect(pagina.find('[role="status"].aviso').text()).toContain('2 pendências marcadas com Ciente.');
    expect(aba(pagina, 'Pendências')!.find('.contador').text()).toBe('1'); // só a bloqueante
  });

  it('com partida aguardando o site: desabilitado, com o motivo e o progresso; o Ciente de uma continua', async () => {
    const { pagina, api } = await montar({ aguardando: 3 });
    await abrirPendencias(pagina);

    const todas = botao(pagina, 'Ciente de todas')!;
    expect(todas.attributes('disabled')).toBeDefined();
    const motivo = pagina.find(`#${todas.attributes('aria-describedby')}`);
    // 8 partidas: 5 o site já respondeu (4 conferidas e a não encontrada), 3 aguardando
    expect(motivo.text()).toBe('"Ciente de todas" libera quando o site conferir todas as partidas (5 de 8 até agora). Enquanto isso, dê Ciente uma a uma.');

    await todas.trigger('click');
    await flushPromises();
    expect(dialogoDoCienteDeTodas(pagina).attributes('open')).toBeUndefined();

    await botao(cartao(pagina, 'Linha duplicada'), 'Ciente')!.trigger('click');
    await flushPromises();
    expect(api.estado.pedidos).toContain(`PUT /api/torneios/1/pendencias/${'b'.repeat(64)}/ciente`);
  });

  it('o site terminou: o botão libera e o motivo some', async () => {
    const { pagina } = await montar();
    await abrirPendencias(pagina);
    const todas = botao(pagina, 'Ciente de todas')!;
    expect(todas.attributes('disabled')).toBeUndefined();
    expect(todas.attributes('aria-describedby')).toBeUndefined();
    expect(pagina.text()).not.toContain('libera quando o site conferir');
  });

  it('a API recusou (409: uma partida voltou para a fila entre a tela e o clique): mostra a frase da API', async () => {
    const { pagina, api } = await montar();
    await abrirPendencias(pagina);
    await botao(pagina, 'Ciente de todas')!.trigger('click');
    await flushPromises();
    api.partidas[0].statusConferencia = 'aguardando';

    await botao(dialogoDoCienteDeTodas(pagina), 'Marcar Ciente em 3')!.trigger('click');
    await flushPromises();
    expect(pagina.find('#painel-pendencias [role="alert"].aviso').text()).toContain('1 partida ainda aguarda o site');
    expect(api.pendencias.filter((p) => p.ciente)).toHaveLength(0);
  });

  it('cancelar não marca nada', async () => {
    const { pagina, api } = await montar();
    await abrirPendencias(pagina);
    await botao(pagina, 'Ciente de todas')!.trigger('click');
    await flushPromises();
    expect(dialogoDoCienteDeTodas(pagina).text()).toContain('Marcar Ciente em 3 pendências?');
    await botao(dialogoDoCienteDeTodas(pagina), 'Cancelar')!.trigger('click');
    await flushPromises();
    expect(api.estado.pedidos).not.toContain('POST /api/torneios/1/pendencias/ciente-de-todas');
  });
});

describe('depois do cálculo', () => {
  it('a lista fica só para leitura: sem Ciente, Desfazer nem Ciente de todas', async () => {
    const { pagina } = await montar({ calculado: true });
    await abrirPendencias(pagina);
    const painel = pagina.find('#painel-pendencias');
    expect(painel.findAll('article.pendencia').length).toBeGreaterThan(0);
    expect(painel.findAll('button')).toHaveLength(0);
    expect(painel.text()).toContain('O torneio já foi calculado');
  });
});
