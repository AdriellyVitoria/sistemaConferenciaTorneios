import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cientes', (t) => {
    t.increments('id');
    t.integer('torneio_id').unsigned().notNullable().references('id').inTable('torneios').onDelete('CASCADE');
    t.specificType('chave', 'char(64)').notNullable();
    t.dateTime('ciente_em', { precision: 3 }).notNullable();
    t.unique(['torneio_id', 'chave']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('cientes');
}
