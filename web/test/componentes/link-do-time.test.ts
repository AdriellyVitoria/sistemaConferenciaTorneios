// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from '../../src/App.vue';
import { rotas } from '../../src/roteador';

const CODIGO = 'CorvosCorvosCorvosCorvosCorvos12';
const CODIGO_PUBLICO = 'PublicoPublicoPublicoPublico1234';

const jogador = (nick: string, base: number, centesimos: number, premioCentavos: number, recebeuCentavo = false) => ({
  nick, base, baseUsada: 'minutos', centesimosDePercentual: centesimos, premioCentavos, recebeuCentavo, explicacao: null,
});

/** O link dos Corvos como a API devolve em GET /time/:codigo (a ordem é a da API: do maior valor para o menor). */
const CORVOS = {
  torneio: { nome: 'Torneio de Setembro/2026' },
  calculadoEm: '2026-10-15T13:05:00.000Z',
  time: { nome: 'Corvos', posicao: 2, premioCentavos: 300_000, baseUsada: 'minutos', baseTime: 865 },
  comoFoiCalculado: { premioTotalCentavos: 1_000_000, percentualDaPosicao: 30, criterio: 'desempate por kills do time', empate: null, modoDivisao: 'minutos' },
  jogadores: [
    jogador('Corvinho', 173, 2000, 60_000), jogador('M4theus', 173, 2000, 60_000), jogador('Nina.exe', 173, 2000, 60_000),
    jogador('Zeca', 173, 2000, 60_000), jogador('Bia.gg', 154, 1780, 53_410), jogador('Tuca', 19, 220, 6_590, true),
  ],
  totalCentavos: 300_000,
  codigoPublico: CODIGO_PUBLICO,
};

const montadas: VueWrapper[] = [];
let pedidos: string[] = [];
afterEach(() => {
  for (const p of montadas.splice(0)) p.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

async function abrir(caminho: string, resposta: { status: number; corpo: unknown } = { status: 200, corpo: CORVOS }) {
  pedidos = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    pedidos.push(String(url));
    const corpo = String(url).startsWith('/api/time/') ? resposta : { status: 200, corpo: { api: 'ok', banco: 'ok' } };
    return new Response(JSON.stringify(corpo.corpo), { status: corpo.status, headers: { 'content-type': 'application/json' } });
  }));
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  await roteador.push(caminho);
  await roteador.isReady();
  const app = mount(App, { global: { plugins: [roteador] }, attachTo: document.body });
  montadas.push(app);
  await flushPromises();
  return app;
}

const cartoes = (app: VueWrapper) => app.findAll('.cartao-jogador');
const nicks = (app: VueWrapper) => cartoes(app).map((c) => c.find('.nick').text());

describe('link do time: Corvos', () => {
  it('topo: o torneio, o time e o resumo (colocação, prêmio e minutos do time)', async () => {
    const app = await abrir(`/time/${CODIGO}`);
    expect(app.find('h1').text()).toBe('Corvos');
    expect(app.text()).toContain('Torneio de Setembro/2026 · link do time');
    const resumo = app.find('[aria-label="Resumo do time"]');
    expect(resumo.text()).toContain('Colocação');
    expect(resumo.text()).toContain('2º lugar');
    expect(resumo.text()).toContain('Prêmio do time');
    expect(resumo.text()).toContain('R$ 3.000,00');
    expect(resumo.text()).toContain('Minutos jogados pelo time');
    expect(resumo.text()).toContain('865');
    expect(document.title).toBe('Prêmio do time Corvos');
    expect(pedidos).toEqual([`/api/time/${CODIGO}`]);
  });

  it('"Como o valor foi calculado": os passos, numa lista ordenada, sem citar outros times', async () => {
    const app = await abrir(`/time/${CODIGO}`);
    const passos = app.find('section[aria-labelledby="t-como"] ol').findAll('li').map((li) => li.text());
    expect(passos).toEqual([
      'O prêmio do torneio é R$ 10.000,00. O 2º lugar leva 30%: R$ 3.000,00.',
      'Houve empate em vitórias; o desempate foi pelas kills do time, e Corvos ficou em 2º.',
      'Dentro do time, o valor é dividido pelos minutos que cada um jogou, conforme o registro oficial de cada partida.',
      'Os valores são arredondados para o centavo. O centavo que sobra vai para quem estava mais perto de recebê-lo.',
    ]);
    for (const outro of ['Lobos', 'Falcões', 'Tubarões', 'Panteras', 'Serpentes']) expect(app.text()).not.toContain(outro);
  });

  it('"Valor de cada jogador": só os 6 dos Corvos, do maior valor para o menor, com a conta', async () => {
    const app = await abrir(`/time/${CODIGO}`);
    expect(nicks(app)).toEqual(['Corvinho', 'M4theus', 'Nina.exe', 'Zeca', 'Bia.gg', 'Tuca']);
    expect(cartoes(app)[0].text()).toContain('R$ 600,00');
    expect(cartoes(app)[0].text()).toContain('173 de 865 minutos (20,00%) × R$ 3.000,00');
  });

  it('Tuca: R$ 65,90 e o texto do centavo de arredondamento; os outros, sem esse texto', async () => {
    const app = await abrir(`/time/${CODIGO}`);
    const tuca = cartoes(app).find((c) => c.find('.nick').text() === 'Tuca')!;
    expect(tuca.text()).toContain('R$ 65,90');
    expect(tuca.text()).toContain('19 de 865 minutos (2,20%) × R$ 3.000,00');
    expect(tuca.text()).toContain('Recebeu R$ 0,01 de arredondamento: era o jogador do time mais perto de receber o centavo que sobrou.');
    expect(cartoes(app).filter((c) => c.text().includes('Recebeu R$ 0,01'))).toHaveLength(1);
  });

  it('"Total do time": R$ 3.000,00', async () => {
    const app = await abrir(`/time/${CODIGO}`);
    expect(app.find('.total-do-time').text()).toBe('Total do timeR$ 3.000,00');
  });
});

describe('"Procurar meu nick"', () => {
  it('tem rótulo; parcial e sem diferenciar maiúsculas, com o resultado anunciado ao leitor de tela', async () => {
    const app = await abrir(`/time/${CODIGO}`);
    const campo = app.find('input[type="search"]');
    expect(app.find(`label[for="${campo.attributes('id')}"]`).text()).toBe('Procurar meu nick');
    await campo.setValue('TU');
    expect(nicks(app)).toEqual(['Tuca']);
    expect(app.find('.resumo-jogadores').attributes('aria-live')).toBe('polite');
    expect(app.find('.resumo-jogadores').text()).toBe('1 de 6 jogadores');
    // o total continua o do time inteiro
    expect(app.find('.total-do-time').text()).toContain('R$ 3.000,00');
  });

  it('nick que não é do time: avisa', async () => {
    const app = await abrir(`/time/${CODIGO}`);
    await app.find('input[type="search"]').setValue('sniper');
    expect(cartoes(app)).toHaveLength(0);
    expect(app.text()).toContain('Nenhum jogador com esse nick neste time.');
  });
});

describe('é uma página para jogadores (D11)', () => {
  it('o único link é "Ver a classificação completa", para a página pública', async () => {
    const app = await abrir(`/time/${CODIGO}`);
    const links = app.findAll('a');
    expect(links.map((a) => [a.text(), a.attributes('href')])).toEqual([['Ver a classificação completa do torneio', `/publico/${CODIGO_PUBLICO}`]]);
  });

  it('sem o menu "Torneios" e sem o rodapé do sistema', async () => {
    const app = await abrir(`/time/${CODIGO}`);
    expect(app.find('nav').exists()).toBe(false);
    expect(app.text()).not.toContain('Torneios');
    expect(app.text()).not.toContain('Banco de dados');
  });
});

describe('código errado', () => {
  it('404: "Página não encontrada", igual à página pública', async () => {
    const app = await abrir('/time/naoexiste', { status: 404, corpo: { erro: 'Página não encontrada.' } });
    expect(app.find('h1').text()).toBe('Página não encontrada');
    expect(app.text()).toContain('Confira se o link foi copiado inteiro.');
    expect(app.findAll('a')).toEqual([]);
  });

  it('sem código: a mesma página, sem pedir nada à API', async () => {
    const app = await abrir('/time/');
    expect(app.find('h1').text()).toBe('Página não encontrada');
    expect(pedidos).toEqual([]);
  });
});
