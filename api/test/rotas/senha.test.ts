import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../../src/app';
import { COM_SENHA, SENHA_DE_TESTE } from '../ajudantes/senha';

// Sem banco: a senha é conferida antes de qualquer consulta. Um "banco" que falha em tudo prova
// que a requisição barrada nem chega a ele.
const bancoFora = (() => { throw new Error('não devia consultar o banco'); }) as unknown as Knex;

let servidor: Server;
let base: string;

beforeAll(async () => {
  servidor = criarApp({ bd: bancoFora, verificarBanco: async () => {}, senhaDaOrganizadora: SENHA_DE_TESTE }).listen(0);
  await new Promise((pronto) => servidor.once('listening', pronto));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((fechado) => servidor.close(() => fechado())));

const pedir = async (caminho: string, opcoes: RequestInit = {}) => {
  const resposta = await fetch(`${base}${caminho}`, opcoes);
  return { status: resposta.status, cabecalhos: resposta.headers, corpo: resposta.status === 204 ? null : await resposta.json() };
};
const comCabecalho = (authorization: string) => ({ headers: { authorization } });

describe('senha única da organizadora (R3)', () => {
  it('sem senha: 401, com a frase e o WWW-Authenticate, sem tocar no banco', async () => {
    const { status, cabecalhos, corpo } = await pedir('/torneios');
    expect(status).toBe(401);
    expect(corpo).toEqual({ erro: 'Acesso só da organizadora.' });
    expect(cabecalhos.get('www-authenticate')).toBe('Bearer');
  });

  it.each([
    ['senha errada', `Bearer ${SENHA_DE_TESTE}x`],
    ['só o começo da senha', `Bearer ${SENHA_DE_TESTE.slice(0, 5)}`],
    ['senha em maiúsculas', `Bearer ${SENHA_DE_TESTE.toUpperCase()}`],
    ['outro esquema (Basic)', `Basic ${Buffer.from(`maria:${SENHA_DE_TESTE}`).toString('base64')}`],
    ['a senha sem "Bearer"', SENHA_DE_TESTE],
    ['"Bearer" sem senha', 'Bearer'],
  ])('%s: 401', async (_caso, cabecalho) => {
    const { status, corpo } = await pedir('/torneios', comCabecalho(cabecalho));
    expect(status).toBe(401);
    expect(corpo).toEqual({ erro: 'Acesso só da organizadora.' });
  });

  it('GET /acesso: 204 com a senha certa (a tela confere a senha por aqui), 401 sem ela', async () => {
    expect((await pedir('/acesso', { headers: COM_SENHA })).status).toBe(204);
    expect((await pedir('/acesso')).status).toBe(401);
  });

  it('"bearer" em minúsculas também vale (o esquema não diferencia maiúsculas)', async () => {
    expect((await pedir('/acesso', comCabecalho(`bearer ${SENHA_DE_TESTE}`))).status).toBe(204);
  });

  it('rota que não existe, sem senha: 401, e não 404 (não conta quais rotas existem)', async () => {
    expect((await pedir('/nao-existe')).status).toBe(401);
  });

  it('a senha vem antes de ler o corpo: 401 para uma planilha de 6 MB sem senha, e não 413', async () => {
    const { status } = await pedir('/torneios/1/planilha', { method: 'PUT', body: new Uint8Array(6 * 1024 * 1024) });
    expect(status).toBe(401);
  });

  it('abertas, sem senha: /saude, /publico/:codigo e /time/:codigo', async () => {
    expect((await pedir('/saude')).status).toBe(200);
    // código fora do formato: a rota responde 404 sem consultar o banco
    for (const caminho of ['/publico/curto', '/time/curto']) {
      const { status, corpo } = await pedir(caminho);
      expect(status).toBe(404);
      expect(corpo).toEqual({ erro: 'Página não encontrada.' });
    }
  });

  it('nada em /publico e /time pede senha: sem código, ou com outro método, é o mesmo 404', async () => {
    for (const [metodo, caminho] of [['GET', '/publico/'], ['GET', '/time'], ['POST', '/publico/curto'], ['DELETE', '/time/curto'], ['GET', '/publico/a/b']]) {
      const { status, corpo, cabecalhos } = await pedir(caminho, { method: metodo });
      expect(status, `${metodo} ${caminho}`).toBe(404);
      expect(corpo).toEqual({ erro: 'Página não encontrada.' });
      expect(cabecalhos.get('x-robots-tag')).toBe('noindex');
    }
  });
});
