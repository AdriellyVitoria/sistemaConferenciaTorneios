// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost:5173/torneios/1/resultado" }
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import PaginaResultado from '../../src/paginas/PaginaResultado.vue';
import { rotas } from '../../src/roteador';
import { guardarSenha } from '../../src/servicos/sessao';
import { espacosComuns, textoDe } from '../ajudantes/espacos';

// O resultado de setembro como a API devolve, montado dos gabaritos de testes/esperado/ (só lidos)
const ESPERADO = path.resolve(__dirname, '../../../testes/esperado');
const linhas = (arquivo: string) => readFileSync(path.join(ESPERADO, arquivo), 'utf8').split(/\r?\n/).filter(Boolean).slice(1).map((l) => l.split(';'));
const centavos = (texto: string) => Number(texto.replace(',', ''));

function resultadoDeSetembro(modoDivisao: 'minutos' | 'kills' = 'minutos') {
  const times = linhas('torneio-setembro-classificacao.csv').map(([posicao, time, vitorias, kills, premio, criterio]) => ({
    posicao: Number(posicao), time, vitorias: Number(vitorias), killsTime: Number(kills), premioCentavos: centavos(premio), criterio: criterio || null, recebeuCentavo: false,
  }));
  const posicaoDo = (time: string) => times.find((t) => t.time === time)!.posicao;
  const premiados = linhas('torneio-setembro-jogadores.csv').map(([time, nick, minutos, minutosTime, premio]) => ({
    time, posicao: posicaoDo(time), nick, minutos: Number(minutos), kills: 20, base: Number(minutos), baseTime: Number(minutosTime), baseUsada: 'minutos',
    premioCentavos: centavos(premio), recebeuCentavo: nick === 'Tuca', explicacao: null,
  }));
  const semPremio = [
    ...['Mel', 'Pantera_X', 'Rafa.K', 'Sombra', 'Tchê'].map((nick) => ({ time: 'Panteras', nick })),
    ...['Bote', 'Cobrinha', 'Kaio_BR', 'Naja', 'Víbora'].map((nick) => ({ time: 'Serpentes', nick })),
  ].map(({ time, nick }) => ({
    time, posicao: posicaoDo(time), nick, minutos: 150, kills: 25, base: 150, baseTime: 750, baseUsada: 'minutos', premioCentavos: 0, recebeuCentavo: false, explicacao: null,
  }));
  const jogadores = [...premiados, ...semPremio];
  if (modoDivisao === 'kills') for (const j of jogadores) Object.assign(j, { base: j.kills, baseTime: 100, baseUsada: 'kills' });
  return {
    torneio: { id: 1, nome: 'Torneio de setembro' },
    calculadoEm: '2026-10-15T13:05:00.000Z', premioCentavos: 1_000_000, percentuais: [50, 30, 20] as number[], modoDivisao,
    times, jogadores,
  };
}

const SENHA = 'senha-do-teste';
const montadas: VueWrapper[] = [];
afterEach(() => {
  for (const p of montadas.splice(0)) p.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** Os códigos dos links de setembro, como a API devolve em GET /torneios/:id/links. */
const LINKS = {
  publico: { codigo: 'PublicoPublicoPublicoPublico1234' },
  times: [
    { time: 'Lobos', posicao: 1, premioCentavos: 500_000, codigo: 'LobosLobosLobosLobosLobosLobos12' },
    { time: 'Corvos', posicao: 2, premioCentavos: 300_000, codigo: 'CorvosCorvosCorvosCorvosCorvos12' },
    { time: 'Falcões', posicao: 3, premioCentavos: 100_000, codigo: 'FalcoesFalcoesFalcoesFalcoes1234' },
    { time: 'Tubarões', posicao: 3, premioCentavos: 100_000, codigo: 'TubaroesTubaroesTubaroesTubaroes' },
  ],
};

/** O CSV como a API devolve (6c): UTF-8 com BOM, e o nome do arquivo no Content-Disposition. */
const CSV_DE_SETEMBRO = '﻿Posição;Time;Nick;Minutos;Kills;Valor (R$);Centavo de arredondamento;Pago\r\n2;Corvos;Tuca;19;5;65,90;sim;\r\n';
const DISPOSICAO = `attachment; filename="resultado-torneio-de-setembro.csv"; filename*=UTF-8''${encodeURIComponent('resultado-Torneio de setembro.csv')}`;
const csvOk = () => new Response(CSV_DE_SETEMBRO, { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': DISPOSICAO } });

/** Cada pedido à API, com o cabeçalho Authorization (R3). */
let pedidos: { url: string; authorization: string | null }[] = [];

async function montar(
  resposta: { status: number; corpo: unknown } = { status: 200, corpo: resultadoDeSetembro() },
  links: { status: number; corpo: unknown } = { status: 200, corpo: LINKS },
  csv: () => Response = csvOk,
) {
  pedidos = [];
  guardarSenha(SENHA);
  vi.stubGlobal('fetch', vi.fn(async (url: string, opcoes: RequestInit = {}) => {
    pedidos.push({ url: String(url), authorization: new Headers(opcoes.headers).get('authorization') });
    const json = (r: { status: number; corpo: unknown }) => new Response(JSON.stringify(r.corpo), { status: r.status, headers: { 'content-type': 'application/json' } });
    if (String(url) === '/api/torneios/1/resultado') return json(resposta);
    if (String(url) === '/api/torneios/1/links') return json(links);
    if (String(url) === '/api/torneios/1/resultado.csv') return csv();
    return new Response('{}', { status: 404 });
  }));
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  const pagina = mount(PaginaResultado, { props: { id: 1 }, global: { plugins: [roteador] }, attachTo: document.body });
  montadas.push(pagina);
  await flushPromises();
  return pagina;
}

const botaoCsv = (pagina: VueWrapper) => pagina.findAll('button').find((b) => textoDe(b) === 'Baixar CSV')!;
const tabela = (pagina: VueWrapper, legenda: string) => pagina.findAll('table').find((t) => textoDe(t.find('caption')) === legenda)!;
/** O texto que aparece na tela: sem o que é só para o leitor de tela (.visualmente-oculto). */
const visivel = (celula: Element) => {
  const copia = celula.cloneNode(true) as Element;
  copia.querySelectorAll('.visualmente-oculto').forEach((n) => n.remove());
  return espacosComuns((copia.textContent ?? '').trim());
};
const linhasDa = (pagina: VueWrapper, legenda: string) => tabela(pagina, legenda).findAll('tbody tr').map((tr) => tr.findAll('td, th').map((c) => visivel(c.element)));

/** O setembro calculado em 50/50: Corvos fica com o 2º lugar; o empate do 3º fica sem prêmio. */
function setembroEm5050() {
  const resultado = resultadoDeSetembro();
  resultado.percentuais = [50, 50];
  for (const t of resultado.times) {
    if (t.time === 'Corvos') t.premioCentavos = 500_000;
    if (t.time === 'Falcões' || t.time === 'Tubarões') Object.assign(t, { premioCentavos: 0, criterio: 'empate em vitórias e kills' });
  }
  return resultado;
}
const filtrar = async (pagina: VueWrapper, texto: string) => {
  await pagina.find('input[type="search"]').setValue(texto);
};

describe('tela do resultado: cabeçalho', () => {
  it('data do cálculo, modo travado, total distribuído e o botão do CSV', async () => {
    const pagina = await montar();
    const texto = textoDe(pagina);
    expect(texto).toMatch(/Calculado em 15\/10\/2026 às \d{2}:05/);
    expect(texto).toContain('Divisão por minutos jogados (travada)');
    expect(texto).toContain('Total distribuído: R$ 10.000,00');
    expect(texto).toContain('Premia 3 posições: 1º 50% · 2º 30% · 3º 20%');
    expect(botaoCsv(pagina).exists()).toBe(true);
  });

  it('antes do cálculo (409): explica e leva de volta ao torneio', async () => {
    const pagina = await montar({ status: 409, corpo: { erro: 'O torneio ainda não foi calculado.' } });
    expect(textoDe(pagina)).toContain('O torneio ainda não foi calculado.');
    expect(pagina.findAll('a').some((a) => a.attributes('href') === '/torneios/1')).toBe(true);
  });
});

describe('"Baixar CSV" com a senha (R3)', () => {
  // um link comum não manda o cabeçalho Authorization: o CSV vem pelo fetch e a tela salva o arquivo
  let baixados: { nome: string; href: string; conteudo: Blob }[] = [];
  const originais = { criar: URL.createObjectURL, revogar: URL.revokeObjectURL };
  const revogados: string[] = [];
  beforeEach(() => {
    baixados = [];
    revogados.length = 0;
    const blobs = new Map<string, Blob>();
    URL.createObjectURL = vi.fn((blob: Blob) => {
      const endereco = `blob:teste/${blobs.size}`;
      blobs.set(endereco, blob);
      return endereco;
    });
    URL.revokeObjectURL = vi.fn((endereco: string) => { revogados.push(endereco); });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      baixados.push({ nome: this.download, href: this.href, conteudo: blobs.get(this.href)! });
    });
  });
  afterEach(() => {
    URL.createObjectURL = originais.criar;
    URL.revokeObjectURL = originais.revogar;
    vi.restoreAllMocks();
  });

  it('é um botão, e não um link para a API (o link não levaria a senha)', async () => {
    const pagina = await montar();
    expect(botaoCsv(pagina).element.tagName).toBe('BUTTON');
    expect(pagina.findAll('a').some((a) => a.attributes('href')?.includes('resultado.csv'))).toBe(false);
  });

  it('baixa com a senha no cabeçalho e salva com o nome que a API deu, com os acentos', async () => {
    const pagina = await montar();
    await botaoCsv(pagina).trigger('click');
    await flushPromises();

    const pedido = pedidos.find((p) => p.url === '/api/torneios/1/resultado.csv')!;
    expect(pedido.authorization).toBe(`Bearer ${SENHA}`);
    expect(baixados).toHaveLength(1);
    expect(baixados[0].nome).toBe('resultado-Torneio de setembro.csv');
    // o arquivo como veio, com o BOM, para o Excel abrir os acentos certos
    const bytes = new Uint8Array(await baixados[0].conteudo.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    // o endereço temporário do arquivo é liberado depois
    await new Promise((pronto) => setTimeout(pronto, 10));
    expect(revogados).toEqual([baixados[0].href]);
  });

  it('enquanto baixa, o botão fica desabilitado: clique duplo baixa uma vez só', async () => {
    const pagina = await montar();
    await Promise.all([botaoCsv(pagina).trigger('click'), botaoCsv(pagina).trigger('click')]);
    await flushPromises();
    expect(pedidos.filter((p) => p.url === '/api/torneios/1/resultado.csv')).toHaveLength(1);
    expect(baixados).toHaveLength(1);
  });

  it('falhou: avisa junto do botão, com a frase da API, e nada é salvo', async () => {
    const pagina = await montar(undefined, undefined, () => new Response(JSON.stringify({ erro: 'Erro inesperado no servidor. Tente de novo.' }), { status: 500, headers: { 'content-type': 'application/json' } }));
    await botaoCsv(pagina).trigger('click');
    await flushPromises();
    expect(textoDe(pagina.find('.acoes-topo [role="alert"]'))).toBe('Não foi possível baixar o CSV: Erro inesperado no servidor. Tente de novo.');
    expect(baixados).toHaveLength(0);
    expect(botaoCsv(pagina).attributes('disabled')).toBeUndefined();
  });
});

describe('classificação', () => {
  it('posições empatadas (1, 2, 3, 3, 5), com o prêmio logo depois do time e o critério', async () => {
    const pagina = await montar();
    expect(linhasDa(pagina, 'Classificação')).toEqual([
      ['1º', 'Lobos', 'R$ 5.000,00', '5', '353', '—'],
      ['2º', 'Corvos', 'R$ 3.000,00', '3', '368', 'Desempate por kills'],
      ['3º', 'Falcões', 'R$ 1.000,00', '3', '310', 'Empate total · prêmio dividido'],
      ['3º', 'Tubarões', 'R$ 1.000,00', '3', '310', 'Empate total · prêmio dividido'],
      ['5º', 'Panteras', '—', '1', '269', '—'],
      ['6º', 'Serpentes', '—', '0', '249', '—'],
    ]);
    expect(tabela(pagina, 'Classificação').findAll('thead th[scope="col"]').map((t) => textoDe(t))).toEqual(['Posição', 'Time', 'Prêmio', 'Vitórias', 'Kills do time', 'Critério']);
  });

  it('"Premia 3 posições" fica na linha do título "Classificação", e aparece uma vez só na tela', async () => {
    const pagina = await montar();
    const secao = pagina.find('section[aria-labelledby="t-classificacao"]');
    const cabecalho = secao.find('.cabecalho-classificacao');
    expect(textoDe(cabecalho.find('h2#t-classificacao'))).toBe('Classificação');
    expect(textoDe(cabecalho.find('p.texto-suave'))).toBe('Premia 3 posições: 1º 50% · 2º 30% · 3º 20%');
    expect(textoDe(pagina).split('Premia 3 posições')).toHaveLength(2);
  });

  it('o "—" do prêmio de um time fora das posições premiadas é lido como "sem prêmio"', async () => {
    const pagina = await montar();
    const panteras = tabela(pagina, 'Classificação').findAll('tbody tr').find((tr) => textoDe(tr).includes('Panteras'))!;
    const premio = panteras.findAll('td')[1];
    expect(textoDe(premio.find('[aria-hidden="true"]'))).toBe('—');
    expect(textoDe(premio.find('.visualmente-oculto'))).toBe('sem prêmio');
  });

  it('50/50: "Premia 2 posições", o empate do 3º sem prêmio e a frase dizendo por quê', async () => {
    const pagina = await montar({ status: 200, corpo: setembroEm5050() });
    expect(textoDe(pagina)).toContain('Premia 2 posições: 1º 50% · 2º 50%');
    expect(linhasDa(pagina, 'Classificação').map((l) => l.slice(0, 3))).toEqual([
      ['1º', 'Lobos', 'R$ 5.000,00'], ['2º', 'Corvos', 'R$ 5.000,00'], ['3º', 'Falcões', '—'], ['3º', 'Tubarões', '—'], ['5º', 'Panteras', '—'], ['6º', 'Serpentes', '—'],
    ]);
    expect(textoDe(pagina)).toContain('Falcões e Tubarões empataram também em kills (310) e ficaram em 3º. Este torneio premia só 2 posições.');
  });

  it('a frase do empate, montada dos dados', async () => {
    const pagina = await montar();
    expect(textoDe(pagina)).toContain('Corvos, Falcões e Tubarões terminaram com 3 vitórias. Corvos fez mais kills (368) e ficou em 2º. Falcões e Tubarões empataram também em kills (310) e dividiram o prêmio do 3º lugar: R$ 2.000,00, metade para cada time.');
  });
});

describe('prêmio por jogador', () => {
  it('por padrão, os 21 premiados, com o rodapé da soma calculada dos dados', async () => {
    const pagina = await montar();
    expect(linhasDa(pagina, 'Prêmio por jogador')).toHaveLength(21);
    expect(textoDe(pagina.find('[aria-live="polite"].resumo-jogadores'))).toBe('21 jogadores premiados · soma: R$ 10.000,00');
  });

  it('Tuca: minutos "19 de 865", % do time, R$ 65,90 e o centavo de arredondamento', async () => {
    const pagina = await montar();
    const tuca = linhasDa(pagina, 'Prêmio por jogador').find((l) => l[1] === 'Tuca')!;
    expect(tuca).toEqual(['Corvos', 'Tuca', '19 de 865', '2,20%', 'R$ 65,90', '+R$ 0,01 de arredondamento']);
    expect(tabela(pagina, 'Prêmio por jogador').findAll('thead th').map((t) => textoDe(t))).toEqual(['Time', 'Nick', 'Minutos', '% do time', 'Valor', 'Observação']);
  });

  it('modo kills: a coluna é de kills', async () => {
    const pagina = await montar({ status: 200, corpo: resultadoDeSetembro('kills') });
    expect(tabela(pagina, 'Prêmio por jogador').findAll('thead th').map((t) => textoDe(t))[2]).toBe('Kills');
    expect(linhasDa(pagina, 'Prêmio por jogador')[0][2]).toBe('20 de 100');
    expect(textoDe(pagina)).toContain('Divisão por kills (travada)');
  });
});

describe('filtro por nick', () => {
  it('tem rótulo, e o resultado é anunciado ao leitor de tela', async () => {
    const pagina = await montar();
    const campo = pagina.find('input[type="search"]');
    expect(textoDe(pagina.find(`label[for="${campo.attributes('id')}"]`))).toBe('Filtrar por nick');
    expect(pagina.find('.resumo-jogadores').attributes('aria-live')).toBe('polite');
  });

  it('parcial e sem diferenciar maiúsculas: "sniper" acha xXSniperXx', async () => {
    const pagina = await montar();
    await filtrar(pagina, 'sniper');
    expect(linhasDa(pagina, 'Prêmio por jogador').map((l) => l[1])).toEqual(['xXSniperXx']);
    expect(textoDe(pagina.find('.resumo-jogadores'))).toBe('1 de 21 jogadores premiados');
  });

  it('sem diferenciar acentos e de time sem prêmio: "vibora" acha Víbora, com a frase', async () => {
    const pagina = await montar();
    await filtrar(pagina, 'vibora');
    expect(textoDe(pagina)).toContain('Víbora jogou pelo time Serpentes, que ficou em 6º, sem prêmio.');
    expect(pagina.findAll('table').some((t) => textoDe(t.find('caption')) === 'Prêmio por jogador')).toBe(false);
  });

  it('nick inexistente: "Nenhum jogador com esse nick neste torneio."', async () => {
    const pagina = await montar();
    await filtrar(pagina, 'zzz');
    expect(textoDe(pagina)).toContain('Nenhum jogador com esse nick neste torneio.');
  });
});

describe('Links para os times premiados (7d)', () => {
  const ORIGEM = 'http://localhost:5173';
  const secao = (pagina: VueWrapper) => pagina.find('section[aria-labelledby="t-links"]');
  const item = (pagina: VueWrapper, nome: string) => secao(pagina).findAll('li').find((li) => textoDe(li.find('.nome-do-link')) === nome)!;
  const area = (writeText: unknown) => Object.defineProperty(navigator, 'clipboard', { value: writeText === undefined ? undefined : { writeText }, configurable: true });

  it('o link da página pública e um por time premiado, com o endereço completo', async () => {
    const pagina = await montar();
    expect(textoDe(secao(pagina).find('h2'))).toBe('Links para os times premiados');
    expect(secao(pagina).findAll('li').map((li) => [textoDe(li.find('.nome-do-link')), textoDe(li.find('.endereco'))])).toEqual([
      ['Página pública (classificação)', `${ORIGEM}/publico/${LINKS.publico.codigo}`],
      ['Lobos · 1º · R$ 5.000,00', `${ORIGEM}/time/${LINKS.times[0].codigo}`],
      ['Corvos · 2º · R$ 3.000,00', `${ORIGEM}/time/${LINKS.times[1].codigo}`],
      ['Falcões · 3º · R$ 1.000,00', `${ORIGEM}/time/${LINKS.times[2].codigo}`],
      ['Tubarões · 3º · R$ 1.000,00', `${ORIGEM}/time/${LINKS.times[3].codigo}`],
    ]);
  });

  it('cada "Copiar link" tem um nome acessível próprio', async () => {
    const pagina = await montar();
    expect(secao(pagina).findAll('button').map((b) => b.attributes('aria-label'))).toEqual([
      'Copiar link da página pública', 'Copiar link do time Lobos', 'Copiar link do time Corvos', 'Copiar link do time Falcões', 'Copiar link do time Tubarões',
    ]);
    for (const b of secao(pagina).findAll('button')) expect(textoDe(b)).toBe('Copiar link');
  });

  it('"Copiar link" copia o endereço certo e mostra "Link copiado", anunciado ao leitor de tela', async () => {
    const writeText = vi.fn(async () => {});
    area(writeText);
    const pagina = await montar();
    const corvos = item(pagina, 'Corvos · 2º · R$ 3.000,00');
    expect(textoDe(corvos.find('[aria-live="polite"]'))).toBe('');
    await corvos.find('button').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(`${ORIGEM}/time/${LINKS.times[1].codigo}`);
    expect(textoDe(corvos.find('[aria-live="polite"]'))).toBe('Link copiado');
    // só no item copiado
    expect(textoDe(item(pagina, 'Lobos · 1º · R$ 5.000,00').find('[aria-live="polite"]'))).toBe('');
  });

  it('a área de transferência falhou: mostra o link num campo, já selecionado, para copiar à mão', async () => {
    area(vi.fn(async () => { throw new Error('negado'); }));
    const pagina = await montar();
    const publico = item(pagina, 'Página pública (classificação)');
    await publico.find('button').trigger('click');
    await flushPromises();

    const campo = publico.find('input[readonly]');
    const endereco = `${ORIGEM}/publico/${LINKS.publico.codigo}`;
    expect((campo.element as HTMLInputElement).value).toBe(endereco);
    expect(document.activeElement).toBe(campo.element);
    expect((campo.element as HTMLInputElement).selectionStart).toBe(0);
    expect((campo.element as HTMLInputElement).selectionEnd).toBe(endereco.length);
    expect(publico.find(`label[for="${campo.attributes('id')}"]`).exists()).toBe(true);
    expect(textoDe(publico)).toContain('Não foi possível copiar sozinho. O link está selecionado: copie com Ctrl+C (no celular, toque e segure).');
    expect(textoDe(publico.find('[aria-live="polite"]'))).not.toBe('Link copiado');
  });

  it('sem área de transferência no navegador (endereço sem https): o mesmo campo para copiar à mão', async () => {
    area(undefined);
    const pagina = await montar();
    const lobos = item(pagina, 'Lobos · 1º · R$ 5.000,00');
    await lobos.find('button').trigger('click');
    await flushPromises();
    expect((lobos.find('input[readonly]').element as HTMLInputElement).value).toBe(`${ORIGEM}/time/${LINKS.times[0].codigo}`);
  });

  it('os links não carregaram: avisa na seção, e o resto da tela continua', async () => {
    const pagina = await montar(undefined, { status: 500, corpo: { erro: 'Erro inesperado no servidor. Tente de novo.' } });
    expect(textoDe(secao(pagina).find('[role="alert"]'))).toBe('Erro inesperado no servidor. Tente de novo.');
    expect(linhasDa(pagina, 'Classificação')).toHaveLength(6);
  });
});
