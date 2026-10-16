import { readdirSync } from 'node:fs';
import path from 'node:path';
import knex, { type Knex } from 'knex';
import { config } from '../config';

export type Executor = Knex | Knex.Transaction;

export interface DadosConexao {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

const PASTA_MIGRATIONS = path.join(__dirname, 'migrations');

const fonteDeMigrations: Knex.MigrationSource<string> = {
  async getMigrations() {
    return readdirSync(PASTA_MIGRATIONS)
      .filter((arquivo) => /\.(ts|js)$/.test(arquivo) && !arquivo.endsWith('.d.ts'))
      .sort();
  },
  getMigrationName(arquivo) {
    return arquivo.replace(/\.ts$/, '.js');
  },
  async getMigration(arquivo) {
    return import(path.join(PASTA_MIGRATIONS, arquivo));
  },
};

export function criarConexao(dados: DadosConexao): Knex {
  return knex({
    client: 'mysql2',
    connection: {
      ...dados,
      timezone: 'Z',
      typeCast(campo: { type: string; string(): string | null }, proximo: () => unknown) {
        return campo.type === 'DATE' ? campo.string() : proximo();
      },
    },
    pool: {
      min: 0,
      max: 10,
      afterCreate(conexao: { query(sql: string, feito: (erro: unknown) => void): void }, pronto: (erro: unknown, conexao: unknown) => void) {
        conexao.query("SET time_zone = '+00:00'", (erro) => pronto(erro, conexao));
      },
    },
    migrations: { migrationSource: fonteDeMigrations },
  });
}

export const db = criarConexao({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.MYSQL_DATABASE,
  user: config.MYSQL_USER,
  password: config.MYSQL_PASSWORD,
});
