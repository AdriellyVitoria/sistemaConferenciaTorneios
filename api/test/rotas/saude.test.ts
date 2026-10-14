import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { criarApp } from '../../src/app';

let servidor: Server | undefined;

async function getSaude(verificarBanco: () => Promise<void>) {
  servidor = criarApp({ verificarBanco }).listen(0);
  await new Promise((pronto) => servidor!.once('listening', pronto));
  const { port } = servidor.address() as AddressInfo;
  const resposta = await fetch(`http://127.0.0.1:${port}/saude`);
  return { status: resposta.status, corpo: await resposta.json() };
}

afterEach(() => new Promise<void>((fechado) => (servidor ? servidor.close(() => fechado()) : fechado())));

describe('GET /saude', () => {
  it('responde ok quando o banco responde', async () => {
    const { status, corpo } = await getSaude(async () => {});
    expect(status).toBe(200);
    expect(corpo).toEqual({ api: 'ok', banco: 'ok' });
  });

  it('responde 503 quando o banco não responde', async () => {
    const { status, corpo } = await getSaude(async () => { throw new Error('sem conexão'); });
    expect(status).toBe(503);
    expect(corpo).toEqual({ api: 'ok', banco: 'erro' });
  });
});
