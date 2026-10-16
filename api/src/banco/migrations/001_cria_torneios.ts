import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('torneios', (t) => {
    t.increments('id');
    t.string('nome', 120).notNullable();
    t.integer('premio_centavos').unsigned().notNullable();
    t.json('percentuais').notNullable();
    t.enum('modo_divisao', ['minutos', 'kills']).notNullable();
    t.enum('status', ['importado', 'conferindo', 'pronto', 'calculado']).notNullable().defaultTo('importado');
    t.dateTime('calculado_em').nullable();
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('torneios');
}
