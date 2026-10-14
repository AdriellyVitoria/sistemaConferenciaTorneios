import path from 'node:path';
import knex from 'knex';
import { config } from '../config';

export const db = knex({
  client: 'mysql2',
  connection: {
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.MYSQL_DATABASE,
    user: config.MYSQL_USER,
    password: config.MYSQL_PASSWORD,
    // datas sempre em UTC no banco; a tela converte para o horário local
    timezone: 'Z',
  },
  pool: { min: 0, max: 10 },
  migrations: {
    // em desenvolvimento roda os .ts (via tsx); no contêiner, os .js compilados em dist/
    directory: path.join(__dirname, 'migrations'),
    loadExtensions: ['.js', '.ts'],
  },
});
