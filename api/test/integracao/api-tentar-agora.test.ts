import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarApp } from '../../src/app';
import { conectarAoBancoDeTeste, esvaziarTabelas } from './banco-de-teste';
import { COM_SENHA, SENHA_DE_TESTE } from '../ajudantes/senha';

const RAIZ = path.resolve(__dirname, '../../..');
const MINUTO = 60_000;

let bd: Knex;
let agora: Date;
const servidores: Server[] = [];

beforeAll(() => {
  bd = conectarAoBancoDeTeste();
});
afterAll(() => bd.destroy());
beforeEach(async () => {
  await esvaziarTabelas(bd);
  agora = new Date(Date.now() + 2_000);
});
afterEach(async () => {
  for (const s of servidores.splice(0)) await new Promise<void>((fechado) => s.close(() => fechado()));
});

async function subirApi(): Promise<string> {
  const servidor = criarApp({ bd, verificarBanco: async () => {}, agora: () => agora, senhaDaOrganizadora: SENHA_DE_TESTE }).listen(0);
  await new Promise((pronto) => servidor.once('listening', pronto));
  servidores.push(servidor);
  return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
}

async function pedir(base: string, metodo: string, caminho: string, corpo?: unknown) {
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { ...COM_SENHA, ...(corpo instanceof Uint8Array ? {} : { 'content-type': 'application/json' }) },
    body: corpo === undefined ? undefined : corpo instanceof Uint8Array ? corpo : JSON.stringify(corpo),
  });
  return { status: resposta.status, cabecalhos: resposta.headers, corpo: await resposta.json() };
}

async function setembroNoMeioDaConferencia(base: string) {
  const { corpo } = await pedir(base, 'POST', '/torneios', { nome: 'Setembro', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
  await pedir(base, 'PUT', `/torneios/${corpo.id}/planilha`, readFileSync(path.join(RAIZ, 'torneio-setembro.csv')));
  const [p1, p2, p3, p4, ...resto] = await bd('partidas').where({ torneio_id: corpo.id }).orderBy('id');
  const daqui = (ms: number) => new Date(agora.getTime() + ms);
  await bd('partidas').where({ id: p1.id }).update({ tentativas: 3, proxima_tentativa_em: daqui(10 * MINUTO), ultimo_erro: 'O site oficial não respondeu em 15 segundos.', origem_do_erro: 'site' });
  await bd('partidas').where({ id: p2.id }).update({ proxima_tentativa_em: daqui(MINUTO), ultimo_erro: 'Erro inesperado ao conferir a partida; ela será consultada de novo.', origem_do_erro: 'interno' });
  await bd('partidas').where({ id: p3.id }).update({ status_conferencia: 'em_consulta', em_consulta_desde: agora, proxima_tentativa_em: daqui(10 * MINUTO) });
  await bd('partidas').where({ id: p4.id }).update({ status_conferencia: 'nao_encontrada', proxima_tentativa_em: null });
  await bd('partidas').whereIn('id', resto.map((p: { id: number }) => p.id)).update({ status_conferencia: 'conferida', proxima_tentativa_em: null });
  return { id: corpo.id as number, p1, p2, p3, p4 };
}

const buscar = (id: number) => bd('partidas').where({ id }).first();

describe('POST /torneios/:id/tentar-agora', () => {
  it('antecipa para agora as partidas aguardando, sem zerar as tentativas; não mexe nas outras', async () => {
    const base = await subirApi();
    const { id, p1, p2, p3, p4 } = await setembroNoMeioDaConferencia(base);

    const { status, corpo } = await pedir(base, 'POST', `/torneios/${id}/tentar-agora`);
    expect(status).toBe(200);
    expect(corpo).toEqual({ antecipadas: 2, segundosParaTentarAgora: 30 });

    const agoraEmSegundos = new Date(Math.floor(agora.getTime() / 1000) * 1000);
    expect(await buscar(p1.id)).toMatchObject({ status_conferencia: 'aguardando', tentativas: 3, proxima_tentativa_em: agoraEmSegundos, ultimo_erro: 'O site oficial não respondeu em 15 segundos.' });
    expect(await buscar(p2.id)).toMatchObject({ status_conferencia: 'aguardando', proxima_tentativa_em: agoraEmSegundos, origem_do_erro: 'interno' });
    const emConsulta = await buscar(p3.id);
    expect(emConsulta).toMatchObject({ status_conferencia: 'em_consulta', em_consulta_desde: agora });
    expect(emConsulta.proxima_tentativa_em.getTime()).toBeGreaterThan(agora.getTime() + 9 * MINUTO);
    expect(await buscar(p4.id)).toMatchObject({ status_conferencia: 'nao_encontrada', proxima_tentativa_em: null });
  });

  it('bloqueio de 30 s: responde 429 com os segundos que faltam, e libera depois', async () => {
    const base = await subirApi();
    const { id, p1 } = await setembroNoMeioDaConferencia(base);
    await pedir(base, 'POST', `/torneios/${id}/tentar-agora`);
    await bd('partidas').where({ id: p1.id }).update({ proxima_tentativa_em: new Date(agora.getTime() + 5 * MINUTO) });

    agora = new Date(agora.getTime() + 12_500);
    const bloqueado = await pedir(base, 'POST', `/torneios/${id}/tentar-agora`);
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.corpo).toEqual({ erro: 'Aguarde 18 segundos para tentar de novo.', segundosParaTentarAgora: 18 });
    expect(bloqueado.cabecalhos.get('retry-after')).toBe('18');
    expect((await buscar(p1.id)).proxima_tentativa_em.getTime()).toBeGreaterThan(agora.getTime());

    agora = new Date(agora.getTime() + 17_500);
    expect((await pedir(base, 'POST', `/torneios/${id}/tentar-agora`)).status).toBe(200);
  });

  it('o bloqueio fica no banco: vale numa API reiniciada ou em outra instância', async () => {
    const primeira = await subirApi();
    const { id } = await setembroNoMeioDaConferencia(primeira);
    expect((await pedir(primeira, 'POST', `/torneios/${id}/tentar-agora`)).status).toBe(200);

    const outra = await subirApi();
    expect((await pedir(outra, 'POST', `/torneios/${id}/tentar-agora`)).status).toBe(429);
  });

  it('dois cliques ao mesmo tempo: só um antecipa', async () => {
    const base = await subirApi();
    const { id } = await setembroNoMeioDaConferencia(base);
    const respostas = await Promise.all([1, 2, 3].map(() => pedir(base, 'POST', `/torneios/${id}/tentar-agora`)));
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 429, 429]);
  });

  it('sem partida aguardando: 409, e o bloqueio não começa', async () => {
    const base = await subirApi();
    const { id } = await setembroNoMeioDaConferencia(base);
    await bd('partidas').where({ torneio_id: id, status_conferencia: 'aguardando' }).update({ status_conferencia: 'conferida' });

    const { status, corpo } = await pedir(base, 'POST', `/torneios/${id}/tentar-agora`);
    expect(status).toBe(409);
    expect(corpo.erro).toBe('Não há partida aguardando o site.');
    expect((await pedir(base, 'GET', `/torneios/${id}`)).corpo.segundosParaTentarAgora).toBe(0);
  });

  it('depois do cálculo: 409', async () => {
    const base = await subirApi();
    const { id } = await setembroNoMeioDaConferencia(base);
    await bd('torneios').where({ id }).update({ status: 'calculado', calculado_em: agora });
    const { status, corpo } = await pedir(base, 'POST', `/torneios/${id}/tentar-agora`);
    expect(status).toBe(409);
    expect(corpo.erro).toContain('calculado');
  });

  it('torneio que não existe: 404', async () => {
    const base = await subirApi();
    expect((await pedir(base, 'POST', '/torneios/999999/tentar-agora')).status).toBe(404);
  });
});

describe('GET /torneios/:id para a tela de progresso', () => {
  it('traz os segundos que faltam para o "tentar agora" e a origem do erro de cada partida', async () => {
    const base = await subirApi();
    const { id, p1, p2 } = await setembroNoMeioDaConferencia(base);
    expect((await pedir(base, 'GET', `/torneios/${id}`)).corpo.segundosParaTentarAgora).toBe(0);

    await pedir(base, 'POST', `/torneios/${id}/tentar-agora`);
    agora = new Date(agora.getTime() + 10_000);
    const { corpo } = await pedir(base, 'GET', `/torneios/${id}`);
    expect(corpo.segundosParaTentarAgora).toBe(20);
    const porId = new Map(corpo.partidas.map((p: { id: number }) => [p.id, p]));
    expect(porId.get(p1.id)).toMatchObject({ origemDoErro: 'site', tentativas: 3 });
    expect(porId.get(p2.id)).toMatchObject({ origemDoErro: 'interno' });
  });
});
