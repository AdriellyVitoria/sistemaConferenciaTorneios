import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Knex } from 'knex';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../../src/app';
import { COM_SENHA, SENHA_DE_TESTE } from '../ajudantes/senha';

let servidor: Server | undefined;
afterEach(() => new Promise<void>((fechado) => (servidor ? servidor.close(() => fechado()) : fechado())));

const bancoFora = (() => { throw new Error('conexão recusada'); }) as unknown as Knex;

async function subir(bd: Knex) {
  servidor = criarApp({ bd, verificarBanco: async () => {}, senhaDaOrganizadora: SENHA_DE_TESTE }).listen(0);
  await new Promise((pronto) => servidor!.once('listening', pronto));
  return `http://127.0.0.1:${(servidor!.address() as AddressInfo).port}`;
}

describe('tratamento de erros da API: sempre responde, sempre em JSON', () => {
  it('banco fora do ar numa rota: 500 com mensagem, sem deixar a requisição pendurada', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const base = await subir(bancoFora);
    const resposta = await fetch(`${base}/torneios/1`, { headers: COM_SENHA, signal: AbortSignal.timeout(2_000) });
    expect(resposta.status).toBe(500);
    expect(await resposta.json()).toEqual({ erro: 'Erro inesperado no servidor. Tente de novo.' });
  });

  it('JSON malformado: 400', async () => {
    const base = await subir(bancoFora);
    const resposta = await fetch(`${base}/torneios`, { method: 'POST', headers: { ...COM_SENHA, 'content-type': 'application/json' }, body: '{nome:' });
    expect(resposta.status).toBe(400);
    expect((await resposta.json()).erro).toContain('JSON');
  });

  it('planilha maior que 5 MB: 413, antes de tocar no banco', async () => {
    const base = await subir(bancoFora);
    const resposta = await fetch(`${base}/torneios/1/planilha`, { method: 'PUT', headers: COM_SENHA, body: new Uint8Array(6 * 1024 * 1024) });
    expect(resposta.status).toBe(413);
    expect((await resposta.json()).erro).toContain('5 MB');
  });
});
