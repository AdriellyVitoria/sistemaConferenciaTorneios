import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app';
import { carregarPartidas } from '../src/dados';

// Os arquivos de dados são só lidos: nenhum é alterado.
const RAIZ = path.resolve(__dirname, '../..');
const ARQUIVOS = [
  path.join(RAIZ, 'testes/site-oficial.json'),
  path.join(RAIZ, 'api/test/fixtures/site-setembro.json'),
];

let servidor: Server;
let base: string;

beforeEach(async () => {
  servidor = criarApp(carregarPartidas(ARQUIVOS), { esperar: async () => {} }).listen(0);
  await new Promise((pronto) => servidor.once('listening', pronto));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterEach(() => new Promise<void>((fechado) => {
  servidor.closeAllConnections(); // encerra conexões penduradas pelo modo "sem resposta"
  servidor.close(() => fechado());
}));

async function get(caminho: string, opcoes: RequestInit = {}) {
  const resposta = await fetch(`${base}${caminho}`, opcoes);
  const texto = await resposta.text();
  return { status: resposta.status, texto, corpo: resposta.headers.get('content-type')?.includes('json') ? JSON.parse(texto) : null };
}
const post = (caminho: string, corpo?: unknown) =>
  get(caminho, { method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });

describe('modo demonstração: derrubar e religar o site', () => {
  it('começa no ar', async () => {
    expect((await get('/demo/estado')).corpo).toEqual({ estado: 'no_ar' });
    expect((await get('/partidas/40923')).status).toBe(200);
  });

  it('derrubado com erro: as consultas respondem 503 na hora; /saude e /demo continuam de pé', async () => {
    expect((await post('/demo/derrubar', { modo: 'erro' })).corpo).toEqual({ estado: 'fora_com_erro' });
    const consulta = await get('/partidas/40923');
    expect(consulta.status).toBe(503);
    expect(consulta.corpo).toEqual({ status: 'indisponivel', motivo: 'site fora do ar', id: '#40923' });
    expect((await get('/partidas/52214')).status).toBe(503); // nem "não encontrada" ele responde
    expect((await get('/saude')).status).toBe(200);
    expect((await get('/demo/estado')).corpo).toEqual({ estado: 'fora_com_erro' });
  });

  it('derrubado sem resposta: a conexão fica pendurada até o cliente desistir', async () => {
    expect((await post('/demo/derrubar', { modo: 'sem_resposta' })).corpo).toEqual({ estado: 'sem_resposta' });
    await expect(get('/partidas/40923', { signal: AbortSignal.timeout(300) })).rejects.toThrow(/aborted|timeout/i);
    expect((await get('/demo/estado')).corpo).toEqual({ estado: 'sem_resposta' });
  });

  it('religado: volta a responder, e as conexões que estavam penduradas são encerradas', async () => {
    await post('/demo/derrubar', { modo: 'sem_resposta' });
    const pendurada = get('/partidas/40923');
    await new Promise((r) => setTimeout(r, 50)); // dá tempo de a consulta chegar e ficar pendurada

    expect((await post('/demo/religar')).corpo).toEqual({ estado: 'no_ar' });
    await expect(pendurada).rejects.toThrow(); // a conexão perdida não recebe resposta tardia
    const consulta = await get('/partidas/40923');
    expect(consulta.status).toBe(200);
    expect(consulta.corpo.id).toBe('#40923');
  });

  it('religado depois do erro: volta a responder', async () => {
    await post('/demo/derrubar', { modo: 'erro' });
    expect((await get('/partidas/40923')).status).toBe(503);
    await post('/demo/religar');
    expect((await get('/partidas/40923')).status).toBe(200);
  });

  it('com o site fora, as partidas instáveis não gastam as falhas delas', async () => {
    await post('/demo/derrubar', { modo: 'erro' });
    for (let i = 0; i < 3; i++) expect((await get('/partidas/62142')).status).toBe(503);
    await post('/demo/religar');
    // #62142 continua com as 2 falhas próprias antes de responder
    expect((await get('/partidas/62142')).corpo).toEqual({ status: 'indisponivel', id: '#62142' });
    expect((await get('/partidas/62142')).status).toBe(503);
    expect((await get('/partidas/62142')).status).toBe(200);
  });

  it('modo de queda desconhecido: 400 dizendo os modos aceitos', async () => {
    const resposta = await post('/demo/derrubar', { modo: 'explodir' });
    expect(resposta.status).toBe(400);
    expect(resposta.corpo.erro).toContain('erro');
    expect(resposta.corpo.erro).toContain('sem_resposta');
    expect((await get('/demo/estado')).corpo).toEqual({ estado: 'no_ar' });
  });

  it('a página /demo tem os três botões e mostra o estado', async () => {
    const pagina = await get('/demo');
    expect(pagina.status).toBe(200);
    expect(pagina.texto).toContain('Derrubar com erro');
    expect(pagina.texto).toContain('Derrubar sem resposta');
    expect(pagina.texto).toContain('Religar');
    expect(pagina.texto).toContain('/demo/estado');
  });
});
