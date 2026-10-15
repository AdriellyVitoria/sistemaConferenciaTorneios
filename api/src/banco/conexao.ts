import { readdirSync } from 'node:fs';
import path from 'node:path';
import knex, { type Knex } from 'knex';
import { config } from '../config';

/** Quem executa SQL: a conexão ou uma transação aberta. Os repositórios aceitam os dois. */
export type Executor = Knex | Knex.Transaction;

export interface DadosConexao {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

const PASTA_MIGRATIONS = path.join(__dirname, 'migrations');

/**
 * Lista as migrations e registra cada uma SEMPRE com o nome terminado em .js.
 * Em desenvolvimento (tsx, testes) os arquivos são .ts; no contêiner, .js compilados. Sem isso,
 * o Knex gravaria nomes diferentes nos dois casos e acusaria a pasta de migrations como corrompida.
 */
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
      // datas e horas sempre em UTC no banco; a tela converte para o horário local
      timezone: 'Z',
      // DATE volta como texto 'aaaa-mm-dd', igual ao domínio, sem passar por fuso horário
      typeCast(campo: { type: string; string(): string | null }, proximo: () => unknown) {
        return campo.type === 'DATE' ? campo.string() : proximo();
      },
    },
    pool: { min: 0, max: 10 },
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
