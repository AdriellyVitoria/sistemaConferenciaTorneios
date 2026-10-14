import knex from 'knex';
import { config } from '../../src/config';
import { BANCO_DE_TESTE, conectarAoBancoDeTeste } from './banco-de-teste';

/**
 * Roda uma vez antes dos testes de integração: recria o banco de teste do zero, dá acesso ao
 * usuário da aplicação e aplica todas as migrations. Assim as próprias migrations são testadas.
 * Só o root pode criar bancos; os testes em si usam o usuário da aplicação.
 */
export default async function prepararBanco() {
  const root = knex({
    client: 'mysql2',
    connection: {
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: 'root',
      password: process.env.MYSQL_ROOT_PASSWORD ?? 'root',
    },
  });
  try {
    await root.raw('SELECT 1');
  } catch (erro) {
    await root.destroy();
    throw new Error(
      `Não consegui falar com o MySQL em ${config.DB_HOST}:${config.DB_PORT}. ` +
        'Suba o banco com "docker compose up -d mysql" e rode de novo.\n' + String(erro),
    );
  }

  await root.raw(`DROP DATABASE IF EXISTS ${BANCO_DE_TESTE}`);
  await root.raw(`CREATE DATABASE ${BANCO_DE_TESTE} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await root.raw(`GRANT ALL PRIVILEGES ON ${BANCO_DE_TESTE}.* TO ??@'%'`, [config.MYSQL_USER]);
  await root.destroy();

  const bd = conectarAoBancoDeTeste();
  await bd.migrate.latest();
  await bd.destroy();
}
