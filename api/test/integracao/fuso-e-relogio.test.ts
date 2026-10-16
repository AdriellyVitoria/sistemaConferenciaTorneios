import { readFileSync } from 'node:fs';
import path from 'node:path';
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { criarTorneio, importarPlanilha } from '../../src/servicos/torneios';
import { conectarAoBancoDeTeste, esvaziarTabelas } from './banco-de-teste';

/**
 * R2a (code review, "os dois relógios"): o risco não era só o desvio entre os relógios do Node e
 * do MySQL, mas o FUSO. O `timezone: 'Z'` do mysql2 só diz como converter as datas do JavaScript;
 * o NOW() e o CURRENT_TIMESTAMP usam o fuso da SESSÃO do MySQL. Num MySQL configurado em -03:00,
 * esses horários eram gravados 3 horas errados.
 *
 * O teste põe o servidor em -03:00 (fuso global, com o root), abre uma conexão nova e importa a
 * planilha. Corrigido: a sessão é UTC em toda conexão, e a importação grava com o "agora" do Node,
 * o mesmo relógio do job e da correção de ID. O fuso global original volta no fim.
 */

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
  // conexão aberta DEPOIS de mudar o fuso: nasce com a sessão em -03:00, como num MySQL configurado assim
  bd = conectarAoBancoDeTeste();
  await esvaziarTabelas(bd);
});

afterAll(async () => {
  try {
    await bd?.destroy();
  } finally {
    // o fuso global vale para o servidor todo (também o banco de desenvolvimento): sempre volta
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

    // em segundos inteiros, como o job grava as próximas tentativas
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
    // a hora de verdade, segundo o próprio MySQL: segundos desde 1970, que não dependem de fuso
    const [[{ segundos }]] = await root.raw('SELECT UNIX_TIMESTAMP() AS segundos');
    expect(Math.abs(torneio.created_at.getTime() - Number(segundos) * 1000)).toBeLessThan(10_000);
  });
});
