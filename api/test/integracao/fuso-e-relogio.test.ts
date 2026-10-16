import { readFileSync } from 'node:fs';
import path from 'node:path';
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { criarTorneio, importarPlanilha } from '../../src/servicos/torneios';
import { conectarAoBancoDeTeste, esvaziarTabelas } from './banco-de-teste';

const RAIZ = path.resolve(__dirname, '../../..');

let root: Knex;
let fusoOriginal: string;
let bd: Knex;

beforeAll(async () => {
  root = knex({
    client: 'mysql2',
    connection: { host: config.DB_HOST, port: config.DB_PORT, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? 'root' },
  });
  const [[linha]] = await root.raw('SELECT @@global.time_zone AS fuso');
  fusoOriginal = linha.fuso;
  await root.raw("SET GLOBAL time_zone = '-03:00'");
  bd = conectarAoBancoDeTeste();
  await esvaziarTabelas(bd);
});

afterAll(async () => {
  try {
    await bd?.destroy();
  } finally {
    await root.raw('SET GLOBAL time_zone = ?', [fusoOriginal]);
    await root.destroy();
  }
});

describe('fuso da sessão e relógio da importação (R2a)', () => {
  it('toda conexão da API usa UTC, mesmo com o servidor em -03:00', async () => {
    const [[linha]] = await bd.raw('SELECT @@session.time_zone AS fuso');
    expect(linha.fuso).toBe('+00:00');
  });

  it('a importação grava a próxima tentativa e o horário da importação com o "agora" que recebe', async () => {
    const agora = new Date('2026-10-15T12:34:56.789Z');
    const criado = await criarTorneio(bd, { nome: 'Fuso', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
    if (!criado.ok) throw new Error('não criou o torneio');
    const importada = await importarPlanilha(bd, criado.id, readFileSync(path.join(RAIZ, 'torneio-setembro.csv')), 'torneio-setembro.csv', agora);
    expect(importada.tipo).toBe('importada');

    const esperado = new Date('2026-10-15T12:34:56.000Z').getTime();
    const partidas = await bd('partidas').where({ torneio_id: criado.id });
    expect(partidas).toHaveLength(15);
    expect(partidas.map((p) => p.proxima_tentativa_em.getTime())).toEqual(Array(15).fill(esperado));
    const torneio = await bd('torneios').where({ id: criado.id }).first();
    expect(torneio.planilha_importada_em.getTime()).toBe(esperado);
  });

  it('o horário de criação (CURRENT_TIMESTAMP) sai em UTC: o "mês do torneio" não erra na virada do mês', async () => {
    const criado = await criarTorneio(bd, { nome: 'Criação', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
    if (!criado.ok) throw new Error('não criou o torneio');
    const torneio = await bd('torneios').where({ id: criado.id }).first();
    const [[{ segundos }]] = await root.raw('SELECT UNIX_TIMESTAMP() AS segundos');
    expect(Math.abs(torneio.created_at.getTime() - Number(segundos) * 1000)).toBeLessThan(10_000);
  });
});
