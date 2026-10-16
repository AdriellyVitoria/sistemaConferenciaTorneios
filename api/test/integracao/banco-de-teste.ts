import type { Knex } from 'knex';
import { criarConexao } from '../../src/banco/conexao';
import { config } from '../../src/config';

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

export async function horaDoBanco(bd: Knex): Promise<Date> {
  const [[linha]] = await bd.raw('SELECT NOW(3) AS agora');
  return linha.agora;
}

export async function relogioDoBanco(bd: Knex): Promise<() => Date> {
  const antes = Date.now();
  const doBanco = (await horaDoBanco(bd)).getTime();
  const depois = Date.now();
  const diferenca = doBanco - (antes + depois) / 2;
  return () => new Date(Date.now() + diferenca);
}

export async function esvaziarTabelas(bd: Knex) {
  for (const tabela of ['codigos_time', 'premios_jogador','premios_time', 'calculos', 'cientes', 'participacoes', 'linhas_planilha', 'partidas', 'torneios']) {
    await bd(tabela).del();
  }
}
