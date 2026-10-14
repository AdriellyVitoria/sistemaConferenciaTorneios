import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app';
import { carregarPartidas } from '../src/dados';

// Os arquivos de dados são só lidos: nenhum é alterado.
const RAIZ = path.resolve(__dirname, '../..');
const ARQUIVOS = [
  path.join(RAIZ, 'testes/site-oficial.json'),
  path.join(RAIZ, 'api/test/fixtures/site-setembro.json'),
];
const SITE_OFICIAL = JSON.parse(readFileSync(ARQUIVOS[0], 'utf8'));

let servidor: Server;
let base: string;

beforeAll(async () => {
  servidor = criarApp(carregarPartidas(ARQUIVOS)).listen(0);
  await new Promise((pronto) => servidor.once('listening', pronto));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((fechado) => servidor.close(() => fechado())));

async function consultar(caminho: string) {
  const resposta = await fetch(`${base}${caminho}`);
  return { status: resposta.status, corpo: await resposta.json() };
}

describe('GET /partidas/:id', () => {
  it('devolve a #40923 de setembro com os dados da D15 (vitória de Falcões, 62 kills)', async () => {
    const { status, corpo } = await consultar('/partidas/40923');
    expect(status).toBe(200);
    expect(corpo).toMatchObject({ id: '#40923', times: ['Falcões', 'Panteras'], vencedor: 'Falcões' });
    const killsFalcoes = corpo.jogadores
      .filter((j: { time: string }) => j.time === 'Falcões')
      .reduce((soma: number, j: { kills: number }) => soma + j.kills, 0);
    expect(killsFalcoes).toBe(62);
    expect(corpo.jogadores).toHaveLength(10);
  });

  it('devolve uma partida de outro cenário igual ao site-oficial.json', async () => {
    const { status, corpo } = await consultar('/partidas/51003');
    expect(status).toBe(200);
    expect(corpo).toEqual(SITE_OFICIAL['#51003']);
  });

  it('aceita o # codificado na URL (%23), para clientes que codificam o ID', async () => {
    const { status, corpo } = await consultar('/partidas/%2340923');
    expect(status).toBe(200);
    expect(corpo.id).toBe('#40923');
  });

  it('não expõe a configuração do simulador (falhas_antes_de_responder)', async () => {
    const instavel = Object.keys(SITE_OFICIAL).find((id) => 'falhas_antes_de_responder' in SITE_OFICIAL[id])!;
    // a partida instável falha algumas vezes antes de responder (2b); consulta até responder
    let resposta = await consultar(`/partidas/${instavel.slice(1)}`);
    while (resposta.status === 503) resposta = await consultar(`/partidas/${instavel.slice(1)}`);
    const { status, corpo } = resposta;
    expect(status).toBe(200);
    expect(corpo).not.toHaveProperty('falhas_antes_de_responder');
    expect(corpo.id).toBe(instavel);
  });

  it('ID que não existe: 404 com "não encontrada", que é diferente de erro', async () => {
    // #52214 é o ID digitado errado do cenário 02
    const { status, corpo } = await consultar('/partidas/52214');
    expect(status).toBe(404);
    expect(corpo).toEqual({ status: 'nao_encontrada', id: '#52214' });
  });

  it('ID que não é número: 400, porque o pedido está mal feito', async () => {
    const { status, corpo } = await consultar('/partidas/abc');
    expect(status).toBe(400);
    expect(corpo.erro).toContain('ID');
  });
});

describe('carregarPartidas', () => {
  it('junta os arquivos: 133 partidas dos cenários + 15 de setembro', () => {
    const partidas = carregarPartidas(ARQUIVOS);
    expect(partidas.size).toBe(148);
    expect(partidas.has('#40923')).toBe(true);
    expect(partidas.has('#51003')).toBe(true);
  });

  it('recusa o mesmo ID em dois arquivos, em vez de escolher um em silêncio', () => {
    expect(() => carregarPartidas([ARQUIVOS[0], ARQUIVOS[0]])).toThrow('repetido');
  });
});
