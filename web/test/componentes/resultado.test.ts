// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import PaginaResultado from '../../src/paginas/PaginaResultado.vue';
import { rotas } from '../../src/roteador';

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

const montadas: VueWrapper[] = [];
afterEach(() => {
  for (const p of montadas.splice(0)) p.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

async function montar(resposta: { status: number; corpo: unknown } = { status: 200, corpo: resultadoDeSetembro() }) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url) === '/api/torneios/1/resultado') return new Response(JSON.stringify(resposta.corpo), { status: resposta.status, headers: { 'content-type': 'application/json' } });
    return new Response('{}', { status: 404 });
  }));
  const roteador = createRouter({ history: createMemoryHistory(), routes: rotas });
  const pagina = mount(PaginaResultado, { props: { id: 1 }, global: { plugins: [roteador] }, attachTo: document.body });
  montadas.push(pagina);
  await flushPromises();
  return pagina;
}

const tabela = (pagina: VueWrapper, legenda: string) => pagina.findAll('table').find((t) => t.find('caption').text() === legenda)!;
/** O texto que aparece na tela: sem o que é só para o leitor de tela (.visualmente-oculto). */
const visivel = (celula: Element) => {
  const copia = celula.cloneNode(true) as Element;
  copia.querySelectorAll('.visualmente-oculto').forEach((n) => n.remove());
  return (copia.textContent ?? '').trim();
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
    const texto = pagina.text();
    expect(texto).toMatch(/Calculado em 15\/10\/2026 às \d{2}:05/);
    expect(texto).toContain('Divisão por minutos jogados (travada)');
    expect(texto).toContain('Total distribuído: R$ 10.000,00');
    expect(texto).toContain('Premia 3 posições: 1º 50% · 2º 30% · 3º 20%');
    const csv = pagina.findAll('a').find((a) => a.text() === 'Baixar CSV')!;
    expect(csv.attributes('href')).toBe('/api/torneios/1/resultado.csv');
  });

  it('antes do cálculo (409): explica e leva de volta ao torneio', async () => {
    const pagina = await montar({ status: 409, corpo: { erro: 'O torneio ainda não foi calculado.' } });
    expect(pagina.text()).toContain('O torneio ainda não foi calculado.');
    expect(pagina.findAll('a').some((a) => a.attributes('href') === '/torneios/1')).toBe(true);
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
    expect(tabela(pagina, 'Classificação').findAll('thead th[scope="col"]').map((t) => t.text())).toEqual(['Posição', 'Time', 'Prêmio', 'Vitórias', 'Kills do time', 'Critério']);
  });

  it('o "—" do prêmio de um time fora das posições premiadas é lido como "sem prêmio"', async () => {
    const pagina = await montar();
    const panteras = tabela(pagina, 'Classificação').findAll('tbody tr').find((tr) => tr.text().includes('Panteras'))!;
    const premio = panteras.findAll('td')[1];
    expect(premio.find('[aria-hidden="true"]').text()).toBe('—');
    expect(premio.find('.visualmente-oculto').text()).toBe('sem prêmio');
  });

  it('50/50: "Premia 2 posições", o empate do 3º sem prêmio e a frase dizendo por quê', async () => {
    const pagina = await montar({ status: 200, corpo: setembroEm5050() });
    expect(pagina.text()).toContain('Premia 2 posições: 1º 50% · 2º 50%');
    expect(linhasDa(pagina, 'Classificação').map((l) => l.slice(0, 3))).toEqual([
      ['1º', 'Lobos', 'R$ 5.000,00'], ['2º', 'Corvos', 'R$ 5.000,00'], ['3º', 'Falcões', '—'], ['3º', 'Tubarões', '—'], ['5º', 'Panteras', '—'], ['6º', 'Serpentes', '—'],
    ]);
    expect(pagina.text()).toContain('Falcões e Tubarões empataram também em kills (310) e ficaram em 3º. Este torneio premia só 2 posições.');
  });

  it('a frase do empate, montada dos dados', async () => {
    const pagina = await montar();
    expect(pagina.text()).toContain('Corvos, Falcões e Tubarões terminaram com 3 vitórias. Corvos fez mais kills (368) e ficou em 2º. Falcões e Tubarões empataram também em kills (310) e dividiram o prêmio do 3º lugar: R$ 2.000,00, metade para cada time.');
  });
});

describe('prêmio por jogador', () => {
  it('por padrão, os 21 premiados, com o rodapé da soma calculada dos dados', async () => {
    const pagina = await montar();
    expect(linhasDa(pagina, 'Prêmio por jogador')).toHaveLength(21);
    expect(pagina.find('[aria-live="polite"].resumo-jogadores').text()).toBe('21 jogadores premiados · soma: R$ 10.000,00');
  });

  it('Tuca: minutos "19 de 865", % do time, R$ 65,90 e o centavo de arredondamento', async () => {
    const pagina = await montar();
    const tuca = linhasDa(pagina, 'Prêmio por jogador').find((l) => l[1] === 'Tuca')!;
    expect(tuca).toEqual(['Corvos', 'Tuca', '19 de 865', '2,20%', 'R$ 65,90', '+R$ 0,01 de arredondamento']);
    expect(tabela(pagina, 'Prêmio por jogador').findAll('thead th').map((t) => t.text())).toEqual(['Time', 'Nick', 'Minutos', '% do time', 'Valor', 'Observação']);
  });

  it('modo kills: a coluna é de kills', async () => {
    const pagina = await montar({ status: 200, corpo: resultadoDeSetembro('kills') });
    expect(tabela(pagina, 'Prêmio por jogador').findAll('thead th').map((t) => t.text())[2]).toBe('Kills');
    expect(linhasDa(pagina, 'Prêmio por jogador')[0][2]).toBe('20 de 100');
    expect(pagina.text()).toContain('Divisão por kills (travada)');
  });
});

describe('filtro por nick', () => {
  it('tem rótulo, e o resultado é anunciado ao leitor de tela', async () => {
    const pagina = await montar();
    const campo = pagina.find('input[type="search"]');
    expect(pagina.find(`label[for="${campo.attributes('id')}"]`).text()).toBe('Filtrar por nick');
    expect(pagina.find('.resumo-jogadores').attributes('aria-live')).toBe('polite');
  });

  it('parcial e sem diferenciar maiúsculas: "sniper" acha xXSniperXx', async () => {
    const pagina = await montar();
    await filtrar(pagina, 'sniper');
    expect(linhasDa(pagina, 'Prêmio por jogador').map((l) => l[1])).toEqual(['xXSniperXx']);
    expect(pagina.find('.resumo-jogadores').text()).toBe('1 de 21 jogadores premiados');
  });

  it('sem diferenciar acentos e de time sem prêmio: "vibora" acha Víbora, com a frase', async () => {
    const pagina = await montar();
    await filtrar(pagina, 'vibora');
    expect(pagina.text()).toContain('Víbora jogou pelo time Serpentes, que ficou em 6º, sem prêmio.');
    expect(pagina.findAll('table').some((t) => t.find('caption').text() === 'Prêmio por jogador')).toBe(false);
  });

  it('nick inexistente: "Nenhum jogador com esse nick neste torneio."', async () => {
    const pagina = await montar();
    await filtrar(pagina, 'zzz');
    expect(pagina.text()).toContain('Nenhum jogador com esse nick neste torneio.');
  });
});

describe('o que é da etapa 7 não aparece', () => {
  it('sem os links dos times premiados', async () => {
    const pagina = await montar();
    expect(pagina.text()).not.toContain('Links para os times premiados');
  });
});
