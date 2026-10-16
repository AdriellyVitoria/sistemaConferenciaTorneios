import { randomBytes } from 'node:crypto';
import type { Knex } from 'knex';

const COLLATION_BINARIA = 'utf8mb4_bin';
const novoCodigo = () => randomBytes(24).toString('base64url');

export async function up(knex: Knex): Promise<void> {
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
