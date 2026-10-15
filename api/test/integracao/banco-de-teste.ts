import type { Knex } from 'knex';
import { criarConexao } from '../../src/banco/conexao';
import { config } from '../../src/config';

/** Banco só dos testes: recriado a cada execução, nunca o banco de desenvolvimento. */
export const BANCO_DE_TESTE = 'torneios_teste';

export function conectarAoBancoDeTeste(): Knex {
  return criarConexao({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: BANCO_DE_TESTE,
    user: config.MYSQL_USER,
    password: config.MYSQL_PASSWORD,
  });
}

/** Esvazia as tabelas entre um teste e outro (filhas primeiro, por causa das chaves estrangeiras). */
export async function esvaziarTabelas(bd: Knex) {
  for (const tabela of ['cientes', 'participacoes', 'linhas_planilha', 'partidas', 'torneios']) {
    await bd(tabela).del();
  }
}
