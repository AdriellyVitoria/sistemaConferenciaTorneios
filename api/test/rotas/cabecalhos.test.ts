import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../../src/app';
import { SENHA_DE_TESTE } from '../ajudantes/senha';

let servidor: Server;
let base: string;

beforeAll(async () => {
  // a rota de saúde não usa o banco diretamente: só a verificação injetada
  servidor = criarApp({ bd: {} as Knex, verificarBanco: async () => {}, senhaDaOrganizadora: SENHA_DE_TESTE }).listen(0);
  await new Promise((pronto) => servidor.once('listening', pronto));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((fechado) => servidor.close(() => fechado())));

describe('cabeçalhos da API', () => {
  it('não anuncia o Express (code review, item 18: sem X-Powered-By)', async () => {
    const resposta = await fetch(`${base}/saude`);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('x-powered-by')).toBeNull();
  });
});
