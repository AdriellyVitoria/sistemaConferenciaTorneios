import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('partidas', (t) => {
    t.dateTime('em_consulta_desde', { precision: 3 }).nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('partidas', (t) => {
    t.dateTime('em_consulta_desde').nullable().alter();
  });
}
