// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from '../../src/App.vue';
import { rotas } from '../../src/roteador';

// A classificação de setembro como a API devolve em GET /publico/:codigo, montada do gabarito (só lido)
const ESPERADO = path.resolve(__dirname, '../../../testes/esperado');
const linhas = (arquivo: string) => readFileSync(path.join(ESPERADO, arquivo), 'utf8').split(/\r?\n/).filter(Boolean).slice(1).map((l) => l.split(';'));
const centavos = (texto: string) => Number(texto.replace(',', ''));

const CODIGO = 'Ab3_-xYz0123456789abcdefghijklmn';
const DESEMPATE = 'Ganha a melhor posição quem tem mais vitórias. Empate em vitórias: fica na frente o time com mais kills no torneio. '
  + 'Empate também em kills: os prêmios das posições empatadas são somados e divididos igualmente entre os times; '
  + 'se sobrar centavo, ele vai para o time que mais perdeu no arredondamento e, se ainda empatar, pela ordem alfabética do nome do time.';

const PAGINA_DE_SETEMBRO = {
  torneio: { nome: 'Torneio de Setembro/2026' },
  calculadoEm: '2026-10-15T13:05:00.000Z',
  regras: { premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos', criterioDeDesempate: DESEMPATE },
  classificacao: linhas('torneio-setembro-classificacao.csv').map(([posicao, time, vitorias, kills, premio, criterio]) => ({
    posicao: Number(posicao), time, vitorias: Number(vitorias), killsTime: Number(kills), premioCentavos: centavos(premio), criterio: criterio || null,
  })),
};

// todos os nicks de setembro: os premiados do gabarito e os dos times sem prêmio
const NICKS = [
  ...linhas('torneio-setembro-jogadores.csv').map(([, nick]) => nick),
  'Mel', 'Pantera_X', 'Rafa.K', 'Sombra', 'Tchê', 'Bote', 'Cobrinha', 'Kaio_BR', 'Naja', 'Víbora',
];

const montadas: VueWrapper[] = [];
let pedidos: string[] = [];
afterEach(() => {
  for (const p of montadas.splice(0)) p.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

async function abrir(caminho: string, resposta: { status: number; corpo: unknown } = { status: 200, corpo: PAGINA_DE_SETEMBRO }) {
  pedidos = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    pedidos.push(String(url));
    if (String(url).startsWith('/api/publico/')) {
      return new Response(JSON.stringify(resposta.corpo), { status: resposta.status, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ api: 'ok', banco: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  await roteador.push(caminho);
  await roteador.isReady();
  const app = mount(App, { global: { plugins: [roteador] }, attachTo: document.body });
  montadas.push(app);
  await flushPromises();
  return app;
}

const tabela = (app: VueWrapper) => app.findAll('table').find((t) => t.find('caption').text() === 'Classificação')!;
/** O texto que aparece na tela: sem o que é só para o leitor de tela (.visualmente-oculto). */
const visivel = (celula: Element) => {
  const copia = celula.cloneNode(true) as Element;
  copia.querySelectorAll('.visualmente-oculto').forEach((n) => n.remove());
  return (copia.textContent ?? '').trim();
};
const linhasDaTabela = (app: VueWrapper) => tabela(app).findAll('tbody tr').map((tr) => tr.findAll('td, th').map((c) => visivel(c.element)));

/** O setembro calculado em 50/50: Corvos fica com o 2º lugar; o empate do 3º fica sem prêmio. */
const SETEMBRO_EM_50_50 = {
  ...PAGINA_DE_SETEMBRO,
  regras: { ...PAGINA_DE_SETEMBRO.regras, percentuais: [50, 50] },
  classificacao: PAGINA_DE_SETEMBRO.classificacao.map((t) => {
    if (t.time === 'Corvos') return { ...t, premioCentavos: 500_000 };
    if (t.time === 'Falcões' || t.time === 'Tubarões') return { ...t, premioCentavos: 0, criterio: 'empate em vitórias e kills' };
    return t;
  }),
};

describe('página pública: setembro', () => {
  it('nome do torneio e "Calculado em 15/10/2026"', async () => {
    const app = await abrir(`/publico/${CODIGO}`);
    expect(app.find('h1').text()).toBe('Torneio de Setembro/2026');
    expect(app.text()).toContain('Calculado em 15/10/2026');
    expect(pedidos).toContain(`/api/publico/${CODIGO}`);
  });

  it('as regras em texto simples', async () => {
    const texto = (await abrir(`/publico/${CODIGO}`)).text();
    for (const parte of ['Prêmio total', 'R$ 10.000,00', 'Premia 3 posições: 1º 50% · 2º 30% · 3º 20%', 'Proporcional aos minutos que cada jogador jogou', DESEMPATE]) {
      expect(texto).toContain(parte);
    }
  });

  it('classificação com o 3º empatado (1, 2, 3, 3, 5, 6), o prêmio logo depois do time e o critério', async () => {
    const app = await abrir(`/publico/${CODIGO}`);
    expect(linhasDaTabela(app)).toEqual([
      ['1º', 'Lobos', 'R$ 5.000,00', '5', '353', '—'],
      ['2º', 'Corvos', 'R$ 3.000,00', '3', '368', 'Desempate por kills'],
      ['3º', 'Falcões', 'R$ 1.000,00', '3', '310', 'Empate total · prêmio dividido'],
      ['3º', 'Tubarões', 'R$ 1.000,00', '3', '310', 'Empate total · prêmio dividido'],
      ['5º', 'Panteras', '—', '1', '269', '—'],
      ['6º', 'Serpentes', '—', '0', '249', '—'],
    ]);
  });

  it('a tabela tem legenda e cabeçalhos (de coluna e de linha), e o "—" do prêmio é lido como "sem prêmio"', async () => {
    const app = await abrir(`/publico/${CODIGO}`);
    expect(tabela(app).findAll('thead th[scope="col"]').map((t) => t.text())).toEqual(['Posição', 'Time', 'Prêmio', 'Vitórias', 'Kills do time', 'Critério']);
    expect(tabela(app).findAll('tbody th[scope="row"]')).toHaveLength(6);
    const serpentes = tabela(app).findAll('tbody tr').find((tr) => tr.text().includes('Serpentes'))!;
    expect(serpentes.findAll('td')[1].find('.visualmente-oculto').text()).toBe('sem prêmio');
  });

  it('50/50: "Premia 2 posições" nas regras, o 3º empatado sem prêmio e a frase dizendo por quê', async () => {
    const app = await abrir(`/publico/${CODIGO}`, { status: 200, corpo: SETEMBRO_EM_50_50 });
    expect(app.text()).toContain('Premia 2 posições: 1º 50% · 2º 50%. Os outros times não recebem prêmio.');
    expect(linhasDaTabela(app).map((l) => l.slice(0, 3))).toEqual([
      ['1º', 'Lobos', 'R$ 5.000,00'], ['2º', 'Corvos', 'R$ 5.000,00'], ['3º', 'Falcões', '—'], ['3º', 'Tubarões', '—'], ['5º', 'Panteras', '—'], ['6º', 'Serpentes', '—'],
    ]);
    expect(app.text()).toContain('Corvos, Falcões e Tubarões terminaram com 3 vitórias. Corvos fez mais kills (368) e ficou em 2º. Falcões e Tubarões empataram também em kills (310) e ficaram em 3º. Este torneio premia só 2 posições.');
  });

  it('"Premia 3 posições" na linha do título "Classificação", e também nas regras', async () => {
    const app = await abrir(`/publico/${CODIGO}`);
    const cabecalho = app.find('section[aria-labelledby="t-classificacao"] .cabecalho-classificacao');
    expect(cabecalho.find('h2#t-classificacao').text()).toBe('Classificação');
    expect(cabecalho.find('p.texto-suave').text()).toBe('Premia 3 posições: 1º 50% · 2º 30% · 3º 20%');
    expect(app.find('.regras').text()).toContain('Premia 3 posições: 1º 50% · 2º 30% · 3º 20%.');
  });

  it('a frase do empate, montada dos dados, com os nomes dos times', async () => {
    const app = await abrir(`/publico/${CODIGO}`);
    expect(app.text()).toContain('Corvos, Falcões e Tubarões terminaram com 3 vitórias. Corvos fez mais kills (368) e ficou em 2º. Falcões e Tubarões empataram também em kills (310) e dividiram o prêmio do 3º lugar: R$ 2.000,00, metade para cada time.');
  });

  it('o título da aba do navegador é o do torneio', async () => {
    await abrir(`/publico/${CODIGO}`);
    expect(document.title).toBe('Torneio de Setembro/2026 · Classificação');
  });
});

describe('é uma página para jogadores (D11)', () => {
  it('nenhum nick nem valor de jogador na tela', async () => {
    const texto = document.body.textContent ?? '';
    await abrir(`/publico/${CODIGO}`);
    const tela = document.body.textContent ?? '';
    expect(texto).toBe(''); // a tela começou vazia
    expect(NICKS).toHaveLength(31);
    for (const nick of NICKS) expect(tela).not.toContain(nick);
    // valores de jogador de setembro que não são prêmio de nenhum time
    for (const valor of ['R$ 600,00', 'R$ 534,10', 'R$ 65,90', 'R$ 200,00']) expect(tela).not.toContain(valor);
  });

  it('só pede a página pública à API: nada das rotas da Maria, nem a saúde do sistema', async () => {
    await abrir(`/publico/${CODIGO}`);
    expect(pedidos).toEqual([`/api/publico/${CODIGO}`]);
  });

  it('sem o menu "Torneios", sem links para as telas da Maria e sem o rodapé do sistema', async () => {
    const app = await abrir(`/publico/${CODIGO}`);
    expect(app.findAll('a')).toEqual([]);
    expect(app.find('nav').exists()).toBe(false);
    expect(app.text()).not.toContain('Torneios');
    expect(app.text()).not.toContain('Banco de dados');
    // a marca continua, mas como texto
    expect(app.text()).toContain('Premiação de torneios');
  });

  it('as telas da Maria continuam com o menu e o rodapé', async () => {
    const app = await abrir('/torneios/novo');
    expect(app.find('nav').text()).toContain('Torneios');
    expect(app.text()).toContain('Banco de dados');
  });
});

describe('código inválido', () => {
  it('404: "Página não encontrada", sem dizer se o torneio existe, e sem links', async () => {
    const app = await abrir('/publico/naoexiste', { status: 404, corpo: { erro: 'Página não encontrada.' } });
    expect(app.find('h1').text()).toBe('Página não encontrada');
    expect(app.text()).toContain('Confira se o link foi copiado inteiro.');
    // o conteúdo da página (a marca do cabeçalho, "Premiação de torneios", fica de fora)
    expect(app.find('main').text()).not.toMatch(/torneio/i);
    expect(app.findAll('a')).toEqual([]);
    expect(app.find('table').exists()).toBe(false);
  });

  it('sem código: a mesma página, sem pedir nada à API (e não cai na lista da Maria)', async () => {
    const app = await abrir('/publico/');
    expect(app.find('h1').text()).toBe('Página não encontrada');
    expect(pedidos).toEqual([]);
  });

  it('o servidor fora do ar não vira "não encontrada": pede para tentar de novo', async () => {
    const app = await abrir(`/publico/${CODIGO}`, { status: 500, corpo: { erro: 'Erro inesperado no servidor. Tente de novo.' } });
    expect(app.find('[role="alert"]').text()).toBe('Não foi possível carregar a página agora. Tente de novo em alguns minutos.');
    expect(app.find('h1').text()).toBe('Não foi possível carregar');
  });
});

describe('noindex', () => {
  it('o index.html pede aos buscadores que não indexem (vale para o app inteiro)', () => {
    const html = readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });
});
