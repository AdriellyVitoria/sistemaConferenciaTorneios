import { describe, expect, it } from 'vitest';
import type { ItemPendencia } from '../../src/dominio/comparacao';
import { chaveDaPendencia, ehBloqueante } from '../../src/dominio/chave-pendencia';

const DIVERGENCIA: ItemPendencia = {
  tipo: 'divergencia',
  idPartida: '#53132',
  nick: 'Juba',
  campo: 'kills',
  valorPlanilha: '18',
  valorSite: '8',
  acao: 'ciente',
  mensagem: 'Juba na partida #53132: a planilha diz 18 kills e o site diz 8. Usamos o valor do site.',
};

describe('chaveDaPendencia: o Ciente vale para aquela pendência exata', () => {
  it('64 caracteres hexadecimais, sempre a mesma para o mesmo item', () => {
    const chave = chaveDaPendencia(DIVERGENCIA);
    expect(chave).toMatch(/^[0-9a-f]{64}$/);
    expect(chaveDaPendencia({ ...DIVERGENCIA })).toBe(chave);
  });

  it.each([
    ['o tipo', { tipo: 'jogador_so_na_planilha' as const }],
    ['a partida', { idPartida: '#53133' }],
    ['o jogador', { nick: 'Garra' }],
    ['o campo', { campo: 'minutos' as const }],
    ['o valor da planilha', { valorPlanilha: '19' }],
    ['o valor do site', { valorSite: '9' }],
  ])('muda quando muda %s', (_campo, mudanca) => {
    expect(chaveDaPendencia({ ...DIVERGENCIA, ...mudanca })).not.toBe(chaveDaPendencia(DIVERGENCIA));
  });

  it('não muda com o texto da mensagem: reescrever uma frase não apaga os Cientes', () => {
    expect(chaveDaPendencia({ ...DIVERGENCIA, mensagem: 'outra frase' })).toBe(chaveDaPendencia(DIVERGENCIA));
  });

  it('valor ausente é diferente de texto vazio', () => {
    expect(chaveDaPendencia({ ...DIVERGENCIA, valorPlanilha: null })).not.toBe(chaveDaPendencia({ ...DIVERGENCIA, valorPlanilha: '' }));
  });

  it('não confunde campos vizinhos: "a|b" + "c" é diferente de "a" + "b|c"', () => {
    const a = chaveDaPendencia({ ...DIVERGENCIA, valorPlanilha: 'a|b', valorSite: 'c' });
    const b = chaveDaPendencia({ ...DIVERGENCIA, valorPlanilha: 'a', valorSite: 'b|c' });
    expect(a).not.toBe(b);
  });

  describe('itens do torneio todo (sem uma partida só)', () => {
    const DOIS_TIMES: ItemPendencia = {
      tipo: 'jogador_dois_times',
      idPartida: null,
      partidas: ['#57001', '#57210'],
      nick: 'Garra',
      valorPlanilha: null,
      valorSite: 'Leões e Ursos',
      acao: 'ciente',
      mensagem: 'Garra jogou por Leões e Ursos, segundo o site.',
    };

    it('usam a lista de partidas, sem importar a ordem', () => {
      expect(chaveDaPendencia({ ...DOIS_TIMES, partidas: ['#57210', '#57001'] })).toBe(chaveDaPendencia(DOIS_TIMES));
    });

    it('uma partida a mais na lista é outra pendência', () => {
      expect(chaveDaPendencia({ ...DOIS_TIMES, partidas: [...DOIS_TIMES.partidas!, '#57300'] })).not.toBe(chaveDaPendencia(DOIS_TIMES));
    });
  });
});

describe('a chave depois de corrigir o ID da partida (5b)', () => {
  const DUPLICATA: ItemPendencia = {
    tipo: 'duplicata',
    idPartida: '#46065',
    nick: 'Pantera_X',
    valorPlanilha: '2 vezes: 42 min, 8 kills / 42 min, 8 kills',
    valorSite: '42 min, 8 kills',
    acao: 'ciente',
    mensagem: 'Pantera_X aparece 2 vezes na partida #46065 (linhas 38 e 39).',
  };
  // a mesma partida (id interno 17), antes e depois de a Maria corrigir o ID
  const antes = (item: ItemPendencia) => chaveDaPendencia(item, 17);
  const depois = (item: ItemPendencia) => chaveDaPendencia({ ...item, idPartida: '#46056' }, 17);

  it('duplicata: vem da planilha, então a chave não muda com o ID novo', () => {
    expect(depois(DUPLICATA)).toBe(antes(DUPLICATA));
  });

  it('duplicata: muda se o site mostrar outro valor para o jogador (é o único lugar onde a Maria vê esse valor)', () => {
    expect(chaveDaPendencia({ ...DUPLICATA, idPartida: '#46056', valorSite: '40 min, 8 kills' }, 17)).not.toBe(antes(DUPLICATA));
  });

  it('duplicata: outra partida é outra pendência, mesmo com o mesmo texto de ID', () => {
    expect(chaveDaPendencia(DUPLICATA, 18)).not.toBe(chaveDaPendencia(DUPLICATA, 17));
  });

  it('pendência que depende do site: com o ID novo, é outra pendência (outra consulta ao site)', () => {
    expect(depois(DIVERGENCIA)).not.toBe(antes(DIVERGENCIA));
    const nick: ItemPendencia = { ...DIVERGENCIA, tipo: 'nick_diferente', campo: undefined, valorPlanilha: 'xxsniperxx', valorSite: 'xXSniperXx' };
    expect(depois(nick)).not.toBe(antes(nick));
  });
});

describe('ehBloqueante: só se resolve corrigindo o ID', () => {
  it('não encontrada e times diferentes são bloqueantes; o resto aceita Ciente', () => {
    expect(ehBloqueante({ ...DIVERGENCIA, tipo: 'nao_encontrada', acao: 'corrigir_id' })).toBe(true);
    expect(ehBloqueante({ ...DIVERGENCIA, tipo: 'times_diferentes', acao: 'corrigir_id' })).toBe(true);
    for (const tipo of ['sem_dados_planilha', 'duplicata', 'nick_diferente', 'divergencia', 'jogador_so_na_planilha', 'jogador_so_no_site', 'time_escrito_diferente', 'jogador_dois_times'] as const) {
      expect(ehBloqueante({ ...DIVERGENCIA, tipo })).toBe(false);
    }
  });
});
