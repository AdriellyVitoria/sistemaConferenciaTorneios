import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarApp } from '../../src/app';
import { conectarAoBancoDeTeste, esvaziarTabelas } from './banco-de-teste';
import { COM_SENHA, SENHA_DE_TESTE } from '../ajudantes/senha';

const RAIZ = path.resolve(__dirname, '../../..');
const planilha = (arquivo: string) => readFileSync(path.join(RAIZ, arquivo));

let bd: Knex;
let servidor: Server;
let base: string;

beforeAll(async () => {
  bd = conectarAoBancoDeTeste();
  servidor = criarApp({ bd, verificarBanco: async () => {}, senhaDaOrganizadora: SENHA_DE_TESTE }).listen(0);
  await new Promise((pronto) => servidor.once('listening', pronto));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((fechado) => servidor.close(() => fechado()));
  await bd.destroy();
});
beforeEach(() => esvaziarTabelas(bd));

async function pedir(metodo: string, caminho: string, corpo?: unknown, cabecalhos: Record<string, string> = {}) {
  const ehArquivo = corpo instanceof Uint8Array;
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { ...COM_SENHA, ...(corpo && !ehArquivo ? { 'content-type': 'application/json' } : {}), ...cabecalhos },
    body: corpo === undefined ? undefined : ehArquivo ? corpo : JSON.stringify(corpo),
  });
  return { status: resposta.status, corpo: await resposta.json() };
}

const SETEMBRO = { nome: 'Torneio de setembro/2026', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' };

async function criarSetembro(): Promise<number> {
  const { status, corpo } = await pedir('POST', '/torneios', SETEMBRO);
  expect(status).toBe(201);
  return corpo.id;
}

const subir = (id: number, conteudo: Uint8Array, arquivo = 'planilha.csv') =>
  pedir('PUT', `/torneios/${id}/planilha`, conteudo, { 'content-type': 'text/csv', 'x-nome-arquivo': encodeURIComponent(arquivo) });

describe('POST /torneios', () => {
  it('cria o torneio, que nasce "criado" e sem partidas', async () => {
    const id = await criarSetembro();
    const { status, corpo } = await pedir('GET', `/torneios/${id}`);
    expect(status).toBe(200);
    expect(corpo).toMatchObject({ id, ...SETEMBRO, status: 'criado', planilhaArquivo: null, partidas: [] });
  });

  it('percentuais que não somam 100: 400 com a mensagem da D20', async () => {
    const { status, corpo } = await pedir('POST', '/torneios', { ...SETEMBRO, percentuais: [50, 30] });
    expect(status).toBe(400);
    expect(corpo.erros).toEqual([{ campo: 'percentuais', mensagem: 'Os percentuais precisam somar 100. Hoje somam 80.' }]);
  });

  it('recusa prêmio que não é centavo inteiro, modo desconhecido e nome vazio, dizendo cada campo', async () => {
    const { status, corpo } = await pedir('POST', '/torneios', { nome: '', premioCentavos: 10.5, percentuais: [100], modoDivisao: 'pontos' });
    expect(status).toBe(400);
    expect(corpo.erros.map((e: { campo: string }) => e.campo).sort()).toEqual(['modoDivisao', 'nome', 'premioCentavos']);
  });
});

describe('GET /torneios', () => {
  it('sem torneios: lista vazia', async () => {
    expect(await pedir('GET', '/torneios')).toEqual({ status: 200, corpo: [] });
  });

  it('lista o mais novo primeiro, com a quantidade de partidas de cada um', async () => {
    const setembro = await criarSetembro();
    await subir(setembro, planilha('torneio-setembro.csv'), 'torneio-setembro.csv');
    const { corpo: outubro } = await pedir('POST', '/torneios', { ...SETEMBRO, nome: 'Torneio de outubro/2026', modoDivisao: 'kills' });

    const { status, corpo } = await pedir('GET', '/torneios');
    expect(status).toBe(200);
    expect(corpo).toEqual([
      expect.objectContaining({ id: outubro.id, nome: 'Torneio de outubro/2026', modoDivisao: 'kills', status: 'criado', planilhaArquivo: null, quantidadeDePartidas: 0 }),
      expect.objectContaining({ id: setembro, ...SETEMBRO, status: 'importado', planilhaArquivo: 'torneio-setembro.csv', quantidadeDePartidas: 15 }),
    ]);
    expect(corpo[0].criadoEm).toEqual(expect.any(String));
  });

  it('a data da primeira partida da planilha (a lista agrupa por mês); sem planilha, null', async () => {
    const setembro = await criarSetembro();
    await subir(setembro, planilha('torneio-setembro.csv'), 'torneio-setembro.csv');
    const { corpo: semPlanilha } = await pedir('POST', '/torneios', { ...SETEMBRO, nome: 'Sem planilha' });

    const { corpo } = await pedir('GET', '/torneios');
    expect(corpo.find((t: { id: number }) => t.id === setembro).primeiraPartidaEm).toBe('2026-09-05');
    expect(corpo.find((t: { id: number }) => t.id === semPlanilha.id).primeiraPartidaEm).toBeNull();
  });

  it('a planilha nova (D22) muda a data da primeira partida', async () => {
    const id = await criarSetembro();
    await subir(id, planilha('torneio-setembro.csv'), 'torneio-setembro.csv');
    const [cabecalho, ...linhas] = planilha('torneio-setembro.csv').toString('utf8').split('\r\n');
    const soA19 = Buffer.from([cabecalho, ...linhas.filter((l) => l.startsWith('19/09/2026'))].join('\r\n'), 'utf8');
    expect((await subir(id, soA19, 'so-a-rodada-5.csv')).status).toBe(200);

    const { corpo } = await pedir('GET', '/torneios');
    expect(corpo[0].primeiraPartidaEm).toBe('2026-09-19');
  });
});

describe('GET /torneios/:id', () => {
  it('torneio que não existe: 404', async () => {
    expect((await pedir('GET', '/torneios/999999')).status).toBe(404);
  });
});

describe('PUT /torneios/:id/planilha', () => {
  it('planilha original de setembro: 152 linhas e 15 partidas aguardando o site', async () => {
    const id = await criarSetembro();
    const { status, corpo } = await subir(id, planilha('torneio-setembro.csv'), 'torneio-setembro.csv');
    expect(status).toBe(200);
    expect(corpo).toEqual({ linhas: 152, partidas: 15, convertidoDeWindows1252: false, substituiuPlanilhaAnterior: false });

    const torneio = (await pedir('GET', `/torneios/${id}`)).corpo;
    expect(torneio).toMatchObject({ status: 'importado', planilhaArquivo: 'torneio-setembro.csv', planilhaConvertidaDeWindows1252: false });
    expect(torneio.partidas).toHaveLength(15);
    expect(torneio.partidas.every((p: { statusConferencia: string }) => p.statusConferencia === 'aguardando')).toBe(true);
    expect(torneio.partidas.find((p: { idPartida: string }) => p.idPartida === '#40923')).toMatchObject({
      timeA: 'Falcões', timeB: 'Panteras', rodada: 5, data: '2026-09-19', tentativas: 0,
    });
  });

  it('06a: recusada com a coluna Kills faltando, e nada é gravado', async () => {
    const id = await criarSetembro();
    const { status, corpo } = await subir(id, planilha('testes/planilhas/06a-coluna-faltando.csv'));
    expect(status).toBe(400);
    expect(corpo.erros).toEqual([{ linha: 1, coluna: 'Kills', mensagem: 'Falta a coluna "Kills" na planilha.' }]);
    expect((await pedir('GET', `/torneios/${id}`)).corpo).toMatchObject({ status: 'criado', partidas: [] });
  });

  it('06b (separador vírgula): aceita, 150 linhas e 15 partidas', async () => {
    const id = await criarSetembro();
    const { status, corpo } = await subir(id, planilha('testes/planilhas/06b-separador-virgula.csv'));
    expect(status).toBe(200);
    expect(corpo).toMatchObject({ linhas: 150, partidas: 15 });
  });

  it('planilha em Windows-1252: aceita e informa a conversão', async () => {
    const id = await criarSetembro();
    const utf8 = planilha('torneio-setembro.csv').toString('utf8').replace(/^﻿/, '');
    const { status, corpo } = await subir(id, Buffer.from(utf8, 'latin1'));
    expect(status).toBe(200);
    expect(corpo.convertidoDeWindows1252).toBe(true);
    expect((await pedir('GET', `/torneios/${id}`)).corpo.planilhaConvertidaDeWindows1252).toBe(true);
  });

  it('partida com um time só (ID digitado errado numa linha): recusa listando a linha (D23)', async () => {
    const id = await criarSetembro();
    const texto = planilha('torneio-setembro.csv').toString('utf8').replace('#45659;Lobos x Serpentes;Serpentes;Kaio_BR', '#45695;Lobos x Serpentes;Serpentes;Kaio_BR');
    const { status, corpo } = await subir(id, Buffer.from(texto, 'utf8'));
    expect(status).toBe(400);
    expect(corpo.erros).toEqual([expect.objectContaining({
      linha: 7,
      mensagem: 'A partida #45695 tem só o time Serpentes (linha 7). Toda partida precisa ter dois times. Confira o ID.',
    })]);
  });

  it('enviar de novo substitui a planilha anterior inteira (D22)', async () => {
    const id = await criarSetembro();
    await subir(id, planilha('torneio-setembro.csv'));
    const { status, corpo } = await subir(id, planilha('testes/planilhas/01-limpa.csv'), '01-limpa.csv');
    expect(status).toBe(200);
    expect(corpo).toEqual({ linhas: 150, partidas: 15, convertidoDeWindows1252: false, substituiuPlanilhaAnterior: true });

    const torneio = (await pedir('GET', `/torneios/${id}`)).corpo;
    expect(torneio.planilhaArquivo).toBe('01-limpa.csv');
    expect(torneio.partidas.some((p: { idPartida: string }) => p.idPartida === '#40923')).toBe(false);
    const linhas = await bd('linhas_planilha').where({ torneio_id: id }).count({ n: '*' });
    expect(Number(linhas[0].n)).toBe(150);
  });

  it('uma planilha recusada não apaga a que já estava lá', async () => {
    const id = await criarSetembro();
    await subir(id, planilha('torneio-setembro.csv'));
    expect((await subir(id, planilha('testes/planilhas/06a-coluna-faltando.csv'))).status).toBe(400);
    expect((await pedir('GET', `/torneios/${id}`)).corpo.partidas).toHaveLength(15);
  });

  it('depois do cálculo, a planilha fica travada: 409 (D22)', async () => {
    const id = await criarSetembro();
    await subir(id, planilha('torneio-setembro.csv'));
    await bd('torneios').where({ id }).update({ status: 'calculado', calculado_em: bd.fn.now() });
    const { status, corpo } = await subir(id, planilha('testes/planilhas/01-limpa.csv'));
    expect(status).toBe(409);
    expect(corpo.erro).toContain('calculado');
    expect((await pedir('GET', `/torneios/${id}`)).corpo.partidas.some((p: { idPartida: string }) => p.idPartida === '#40923')).toBe(true);
  });

  it('torneio que não existe: 404', async () => {
    expect((await subir(999_999, planilha('torneio-setembro.csv'))).status).toBe(404);
  });

  it('nome do arquivo com acento no cabeçalho chega certo', async () => {
    const id = await criarSetembro();
    await subir(id, planilha('torneio-setembro.csv'), 'Torneio de Setembro — versão 2.csv');
    expect((await pedir('GET', `/torneios/${id}`)).corpo.planilhaArquivo).toBe('Torneio de Setembro — versão 2.csv');
  });
});
