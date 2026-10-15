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

/** A hora do MySQL agora, com milissegundos. */
export async function horaDoBanco(bd: Knex): Promise<Date> {
  const [[linha]] = await bd.raw('SELECT NOW(3) AS agora');
  return linha.agora;
}

/**
 * Um relógio que anda junto com o do MySQL, para o "agora" do job e da API nos testes.
 *
 * Os testes rodam no Windows e o MySQL no Docker, e os dois relógios podem estar um ou dois
 * segundos diferentes. A importação grava a próxima tentativa com o NOW() do MySQL, e o job compara
 * com o "agora" que recebe: se esse "agora" viesse do Node, o teste dependeria da diferença entre
 * os dois relógios. Mede-se uma vez quanto o MySQL está à frente (ou atrás) do Node, descontando a
 * metade do tempo da consulta, e o relógio devolvido soma essa diferença ao Date.now().
 */
export async function relogioDoBanco(bd: Knex): Promise<() => Date> {
  const antes = Date.now();
  const doBanco = (await horaDoBanco(bd)).getTime();
  const depois = Date.now();
  const diferenca = doBanco - (antes + depois) / 2;
  return () => new Date(Date.now() + diferenca);
}

/** Esvazia as tabelas entre um teste e outro (filhas primeiro, por causa das chaves estrangeiras). */
export async function esvaziarTabelas(bd: Knex) {
  for (const tabela of ['codigos_time', 'premios_jogador','premios_time', 'calculos', 'cientes', 'participacoes', 'linhas_planilha', 'partidas', 'torneios']) {
    await bd(tabela).del();
  }
}
