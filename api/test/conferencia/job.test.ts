import { createServer } from 'node:net';
import knex, { type Knex } from 'knex';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { iniciarJob, type Job } from '../../src/conferencia/job';
import type { SiteOficial } from '../../src/conferencia/site-oficial';

async function portaSemNinguem(): Promise<number> {
  const servidor = createServer().listen(0, '127.0.0.1');
  await new Promise((pronto) => servidor.once('listening', pronto));
  const { port } = servidor.address() as { port: number };
  await new Promise<void>((fechado) => servidor.close(() => fechado()));
  return port;
}

const siteQueNuncaEChamado: SiteOficial = {
  consultarPartida: async () => {
    throw new Error('não deveria consultar sem banco');
  },
};

let job: Job | undefined;
let bd: Knex | undefined;
afterEach(async () => {
  await job?.parar();
  await bd?.destroy();
  vi.restoreAllMocks();
});

describe('o job não para quando uma rodada falha', () => {
  it('MySQL fora do ar: registra no log e tenta de novo na próxima rodada, várias vezes', async () => {
    bd = knex({
      client: 'mysql2',
      connection: { host: '127.0.0.1', port: await portaSemNinguem(), user: 'x', password: 'x', database: 'x' },
      acquireConnectionTimeout: 200,
      pool: { min: 0, max: 1 },
    });
    const erros = vi.spyOn(console, 'error').mockImplementation(() => {});

    job = iniciarJob({ bd, site: siteQueNuncaEChamado, intervalosMs: [60_000], lote: 3, presaAposMs: 120_000, acordarACadaMs: 10 });

    await vi.waitFor(() => expect(erros.mock.calls.length).toBeGreaterThanOrEqual(3), { timeout: 5_000 });
    expect(erros.mock.calls.every(([mensagem]) => mensagem === 'Conferência: a rodada falhou e será tentada de novo.')).toBe(true);

    await job.parar();
    const depoisDeParar = erros.mock.calls.length;
    await new Promise((pronto) => setTimeout(pronto, 300));
    expect(erros.mock.calls.length).toBe(depoisDeParar);
  });
});
