import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { criarApp, type OpcoesSite } from '../src/app';
import { carregarPartidas } from '../src/dados';
import { lerDemora } from '../src/config';

// Os arquivos de dados são só lidos: nenhum é alterado.
const RAIZ = path.resolve(__dirname, '../..');
const ARQUIVOS = [
  path.join(RAIZ, 'testes/site-oficial.json'),
  path.join(RAIZ, 'api/test/fixtures/site-setembro.json'),
];

let servidor: Server | undefined;
afterEach(() => new Promise<void>((fechado) => (servidor ? servidor.close(() => fechado()) : fechado())));

/** Sobe o site com dados novos (o contador de falhas começa do zero) e devolve a função de consulta. */
async function subir(opcoes: OpcoesSite) {
  servidor = criarApp(carregarPartidas(ARQUIVOS), opcoes).listen(0);
  await new Promise((pronto) => servidor!.once('listening', pronto));
  const base = `http://127.0.0.1:${(servidor!.address() as AddressInfo).port}`;
  return async (id: string) => {
    const resposta = await fetch(`${base}/partidas/${id}`);
    return { status: resposta.status, corpo: await resposta.json() };
  };
}

/** Um "esperar" falso: registra quanto foi pedido e só libera quando o teste mandar. Nada espera de verdade. */
function esperaControlada() {
  const pedidos: number[] = [];
  const pendentes: (() => void)[] = [];
  const esperar = (ms: number) =>
    new Promise<void>((liberar) => {
      pedidos.push(ms);
      pendentes.push(liberar);
    });
  const liberarTudo = () => pendentes.splice(0).forEach((liberar) => liberar());
  return { esperar, pedidos, liberarTudo };
}

const semDemora: OpcoesSite = { demora: { minMs: 0, maxMs: 0 }, esperar: async () => {} };

describe('demora de cada consulta', () => {
  it('a resposta só chega depois da demora', async () => {
    const espera = esperaControlada();
    const consultar = await subir({ demora: { minMs: 2_000, maxMs: 10_000 }, esperar: espera.esperar, aleatorio: () => 0.5 });

    let chegou = false;
    const consulta = consultar('40923').then((r) => { chegou = true; return r; });
    await new Promise((r) => setTimeout(r, 50)); // dá tempo de a requisição chegar ao servidor
    expect(espera.pedidos).toEqual([6_000]); // 2 s + metade de 8 s
    expect(chegou).toBe(false);

    espera.liberarTudo();
    expect((await consulta).status).toBe(200);
  });

  it('sorteia entre o mínimo e o máximo, incluindo os dois extremos', async () => {
    const sorteios = [0, 0.999999, 0.25]; // o menor sorteio possível, o maior e um do meio
    const pedidos: number[] = [];
    const consultar = await subir({
      demora: { minMs: 2_000, maxMs: 10_000 },
      esperar: async (ms) => { pedidos.push(ms); },
      aleatorio: () => sorteios.shift()!,
    });
    for (let i = 0; i < 3; i++) await consultar('40923');
    expect(pedidos).toEqual([2_000, 10_000, 4_000]);
  });

  it('também demora antes de responder "não encontrada" e antes de falhar', async () => {
    const pedidos: number[] = [];
    const consultar = await subir({ demora: { minMs: 3_000, maxMs: 3_000 }, esperar: async (ms) => { pedidos.push(ms); } });
    expect((await consultar('52214')).status).toBe(404);
    expect((await consultar('62142')).status).toBe(503);
    expect(pedidos).toEqual([3_000, 3_000]);
  });
});

describe('falhas por partida (falhas_antes_de_responder)', () => {
  it('#62142 (novembro) falha 2 vezes e depois responde sempre', async () => {
    const consultar = await subir(semDemora);
    const status = [];
    for (let i = 0; i < 4; i++) status.push((await consultar('62142')).status);
    expect(status).toEqual([503, 503, 200, 200]);
  });

  it('#62477 (novembro) falha 5 vezes e depois responde com a partida', async () => {
    const consultar = await subir(semDemora);
    for (let i = 0; i < 5; i++) {
      expect(await consultar('62477')).toEqual({ status: 503, corpo: { status: 'indisponivel', id: '#62477' } });
    }
    const { status, corpo } = await consultar('62477');
    expect(status).toBe(200);
    expect(corpo.id).toBe('#62477');
    expect(corpo).not.toHaveProperty('falhas_antes_de_responder');
  });

  it('cada partida tem o seu contador; partidas sem o campo nunca falham', async () => {
    const consultar = await subir(semDemora);
    expect((await consultar('62142')).status).toBe(503);
    expect((await consultar('40923')).status).toBe(200);
    expect((await consultar('62477')).status).toBe(503);
    expect((await consultar('62142')).status).toBe(503);
    expect((await consultar('62142')).status).toBe(200);
  });

  it('ID inválido ou inexistente não gasta falha de ninguém', async () => {
    const consultar = await subir(semDemora);
    expect((await consultar('abc')).status).toBe(400);
    expect((await consultar('52214')).status).toBe(404);
    expect((await consultar('62142')).status).toBe(503);
    expect((await consultar('62142')).status).toBe(503);
    expect((await consultar('62142')).status).toBe(200);
  });
});

describe('lerDemora (variáveis de ambiente)', () => {
  it('padrão de 2 a 10 segundos, como o site real', () => {
    expect(lerDemora({})).toEqual({ minMs: 2_000, maxMs: 10_000 });
  });

  it('aceita uma demora curta para a demonstração', () => {
    expect(lerDemora({ SITE_DEMORA_MIN_MS: '200', SITE_DEMORA_MAX_MS: '800' })).toEqual({ minMs: 200, maxMs: 800 });
    expect(lerDemora({ SITE_DEMORA_MIN_MS: '0', SITE_DEMORA_MAX_MS: '0' })).toEqual({ minMs: 0, maxMs: 0 });
  });

  it('recusa valores inválidos com mensagem clara', () => {
    expect(() => lerDemora({ SITE_DEMORA_MIN_MS: 'rápido' })).toThrow('SITE_DEMORA_MIN_MS');
    expect(() => lerDemora({ SITE_DEMORA_MIN_MS: '5000', SITE_DEMORA_MAX_MS: '1000' })).toThrow('mínimo');
  });
});
