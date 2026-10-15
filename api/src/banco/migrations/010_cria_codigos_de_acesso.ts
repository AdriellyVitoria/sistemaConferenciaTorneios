import { randomBytes } from 'node:crypto';
import type { Knex } from 'knex';

/**
 * Os códigos dos links (D11, etapa 7a), gerados no cálculo, na mesma transação do resultado.
 *
 * - calculos.codigo_publico: o da página pública do torneio. Fica no próprio cálculo: um por
 *   cálculo, obrigatório, e some junto com ele.
 * - codigos_time: um por time PREMIADO (premios_time com prêmio > 0), ligado à linha do time no
 *   cálculo. Times sem prêmio não têm código: eles veem a página pública.
 *
 * Os dois são únicos no banco e com collation binária: o código é base64url, em que "a" e "A" são
 * caracteres diferentes. Com a collation padrão (que ignora maiúsculas), "abc" acharia "ABC".
 *
 * Torneios calculados antes desta migration recebem os códigos aqui mesmo, para nenhum cálculo
 * ficar sem link. A geração está repetida aqui de propósito (e não importada do domínio): uma
 * migration é uma foto, e precisa fazer sempre a mesma coisa, mesmo que o domínio mude depois.
 */

const COLLATION_BINARIA = 'utf8mb4_bin';
const novoCodigo = () => randomBytes(24).toString('base64url');

export async function up(knex: Knex): Promise<void> {
  // nasce aceitando nulo, para preencher os cálculos que já existem; depois vira obrigatória
  await knex.schema.alterTable('calculos', (t) => {
    t.string('codigo_publico', 32).collate(COLLATION_BINARIA).nullable();
  });

  await knex.schema.createTable('codigos_time', (t) => {
    t.increments('id');
    t.integer('premio_time_id').unsigned().notNullable().unique().references('id').inTable('premios_time').onDelete('CASCADE');
    t.string('codigo', 32).collate(COLLATION_BINARIA).notNullable().unique();
  });

  for (const { id } of await knex('calculos').select('id')) {
    await knex('calculos').where({ id }).update({ codigo_publico: novoCodigo() });
  }
  const premiados = await knex('premios_time').where('premio_centavos', '>', 0).select('id');
  if (premiados.length) {
    await knex('codigos_time').insert(premiados.map(({ id }) => ({ premio_time_id: id, codigo: novoCodigo() })));
  }

  await knex.schema.alterTable('calculos', (t) => {
    t.string('codigo_publico', 32).collate(COLLATION_BINARIA).notNullable().alter();
    t.unique(['codigo_publico']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('codigos_time');
  await knex.schema.alterTable('calculos', (t) => {
    t.dropUnique(['codigo_publico']);
    t.dropColumn('codigo_publico');
  });
}
