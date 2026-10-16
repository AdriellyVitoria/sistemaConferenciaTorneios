import { describe, expect, it } from 'vitest';
import {
  agruparPorMes,
  filtrarTorneios,
  mesDoTorneio,
  mesesDisponiveis,
  premiosCalculados,
  rotuloDoMes,
  rotuloDosPremios,
} from '../src/dominio/lista-torneios';
import type { ResumoTorneio } from '../src/servicos/api';
import { comEspacosComuns } from './ajudantes/espacos';

const FUSO = 'America/Sao_Paulo';

function torneio(extra: Partial<ResumoTorneio>): ResumoTorneio {
  return {
    id: 1, nome: 'Torneio', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos', status: 'importado',
    calculadoEm: null, planilhaArquivo: 'torneio.csv', planilhaImportadaEm: '2026-10-14T13:00:00.000Z', planilhaConvertidaDeWindows1252: false,
    criadoEm: '2026-10-14T13:00:00.000Z', quantidadeDePartidas: 15, primeiraPartidaEm: '2026-10-03', ...extra,
  };
}

const MES_ATUAL = '2026-10';
const OUTUBRO_SEM_PLANILHA = torneio({ id: 5, nome: 'Torneio de outubro', status: 'criado', planilhaArquivo: null, quantidadeDePartidas: 0, primeiraPartidaEm: null, criadoEm: '2026-10-13T15:00:00.000Z' });
const PRIMAVERA_DE_AGOSTO = torneio({ id: 4, nome: 'Copa de Primavera', modoDivisao: 'kills', status: 'conferindo', primeiraPartidaEm: '2026-08-30', criadoEm: '2026-08-29T15:00:00.000Z' });
const RELAMPAGO = torneio({ id: 3, nome: 'Copa relâmpago', status: 'calculado', primeiraPartidaEm: '2026-10-03', calculadoEm: '2026-10-10T18:00:00.000Z', premioCentavos: 300_000 });
const SETEMBRO = torneio({ id: 2, nome: 'Torneio de setembro', status: 'calculado', primeiraPartidaEm: '2026-09-05', calculadoEm: '2026-10-15T13:00:00.000Z', premioCentavos: 1_000_000 });
const DESAFIO = torneio({ id: 1, nome: 'Desafio de setembro', modoDivisao: 'kills', status: 'calculado', primeiraPartidaEm: '2026-09-12', calculadoEm: '2026-09-28T20:00:00.000Z', premioCentavos: 500_000 });
const LISTA = [OUTUBRO_SEM_PLANILHA, PRIMAVERA_DE_AGOSTO, RELAMPAGO, SETEMBRO, DESAFIO];

const nomes = (lista: ResumoTorneio[]) => lista.map((t) => t.nome);

describe('mesDoTorneio: o mês da primeira partida da planilha; sem planilha, o da criação', () => {
  it('pela primeira partida, mesmo que o torneio tenha sido criado ou calculado em outro mês', () => {
    expect(mesDoTorneio(SETEMBRO, FUSO)).toBe('2026-09');
    expect(mesDoTorneio(PRIMAVERA_DE_AGOSTO, FUSO)).toBe('2026-08');
  });

  it('sem planilha: a data de criação, no fuso da tela (00:30 de 01/10 em UTC ainda é setembro em Brasília)', () => {
    expect(mesDoTorneio(OUTUBRO_SEM_PLANILHA, FUSO)).toBe('2026-10');
    expect(mesDoTorneio(torneio({ primeiraPartidaEm: null, criadoEm: '2026-10-01T00:30:00.000Z' }), FUSO)).toBe('2026-09');
  });
});

describe('agruparPorMes', () => {
  it('"Em andamento" no topo, de qualquer mês; depois um grupo por mês, do mais recente para o mais antigo', () => {
    const { emAndamento, meses } = agruparPorMes(LISTA, MES_ATUAL, { fuso: FUSO });
    expect(nomes(emAndamento)).toEqual(['Torneio de outubro', 'Copa de Primavera']);
    expect(meses.map((m) => [m.mes, nomes(m.torneios)])).toEqual([
      ['2026-10', ['Copa relâmpago']],
      ['2026-09', ['Torneio de setembro', 'Desafio de setembro']],
    ]);
  });

  it('o mês atual aberto, os anteriores recolhidos; cada grupo com a quantidade e o total dos prêmios', () => {
    const { meses } = agruparPorMes(LISTA, MES_ATUAL, { fuso: FUSO });
    expect(comEspacosComuns(meses.map((m) => [m.rotulo, m.aberto, m.resumo]))).toEqual([
      ['Outubro de 2026', true, '1 torneio · R$ 3.000,00'],
      ['Setembro de 2026', false, '2 torneios · R$ 15.000,00'],
    ]);
  });

  it('com busca ou um mês escolhido, todos os grupos abrem (o que a Maria procura não fica escondido)', () => {
    const { meses } = agruparPorMes(LISTA, MES_ATUAL, { fuso: FUSO, abrirTodos: true });
    expect(meses.every((m) => m.aberto)).toBe(true);
  });
});

describe('filtrarTorneios: situação, busca, mês e divisão, juntos', () => {
  const todos = { situacao: 'todos', busca: '', mes: 'todos', divisao: 'todas' } as const;

  it('mês: pelo mês do torneio (primeira partida), incluindo os em andamento', () => {
    expect(nomes(filtrarTorneios(LISTA, { ...todos, mes: '2026-09' }, FUSO))).toEqual(['Torneio de setembro', 'Desafio de setembro']);
    expect(nomes(filtrarTorneios(LISTA, { ...todos, mes: '2026-08' }, FUSO))).toEqual(['Copa de Primavera']);
  });

  it('divisão: minutos ou kills', () => {
    expect(nomes(filtrarTorneios(LISTA, { ...todos, divisao: 'kills' }, FUSO))).toEqual(['Copa de Primavera', 'Desafio de setembro']);
    expect(filtrarTorneios(LISTA, { ...todos, divisao: 'minutos' }, FUSO)).toHaveLength(3);
  });

  it('tudo junto: calculados, de setembro, por kills, com "desafio" no nome', () => {
    expect(nomes(filtrarTorneios(LISTA, { situacao: 'calculados', busca: 'DESAFIO', mes: '2026-09', divisao: 'kills' }, FUSO))).toEqual(['Desafio de setembro']);
  });
});

describe('o seletor de mês e o cartão "Prêmios calculados": um conceito só de mês, o do torneio', () => {
  it('os meses do seletor: só os dos torneios, do mais recente para o mais antigo', () => {
    const deJulho = torneio({ id: 9, status: 'calculado', primeiraPartidaEm: '2026-07-04', calculadoEm: '2026-11-02T12:00:00.000Z' });
    expect(mesesDisponiveis([...LISTA, deJulho], FUSO)).toEqual(['2026-10', '2026-09', '2026-08', '2026-07']);
  });

  it('o total do mês é pelo mês do torneio: o setembro calculado em outubro conta em setembro', () => {
    expect(premiosCalculados(LISTA, 'todos', FUSO)).toBe(1_800_000);
    expect(premiosCalculados(LISTA, '2026-09', FUSO)).toBe(1_500_000);
    expect(premiosCalculados(LISTA, '2026-10', FUSO)).toBe(300_000);
    expect(premiosCalculados(LISTA, '2026-08', FUSO)).toBe(0);
  });

  it('o total do cartão bate com o "R$ total" do grupo do mesmo mês', () => {
    const { meses } = agruparPorMes(LISTA, MES_ATUAL, { fuso: FUSO });
    for (const grupo of meses) {
      const totalDoGrupo = grupo.torneios.reduce((soma, t) => soma + t.premioCentavos, 0);
      expect(premiosCalculados(LISTA, grupo.mes, FUSO)).toBe(totalDoGrupo);
    }
  });

  it('o rótulo do cartão: o mês no ano atual; o ano junto quando é outro ano', () => {
    expect(rotuloDosPremios('todos', MES_ATUAL)).toBe('Prêmios calculados');
    expect(rotuloDosPremios('2026-09', MES_ATUAL)).toBe('Prêmios calculados em setembro');
    expect(rotuloDosPremios('2025-12', MES_ATUAL)).toBe('Prêmios calculados em dezembro de 2025');
  });

  it('rotuloDoMes', () => {
    expect(rotuloDoMes('2026-09')).toBe('Setembro de 2026');
    expect(rotuloDoMes('2027-03')).toBe('Março de 2027');
  });
});
