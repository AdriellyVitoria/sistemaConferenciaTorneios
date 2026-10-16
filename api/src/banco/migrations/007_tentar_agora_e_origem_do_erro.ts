import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('torneios', (t) => {
    t.dateTime('tentar_agora_em', { precision: 3 }).nullable();
  });
  await knex.schema.alterTable('partidas', (t) => {
    t.enum('origem_do_erro', ['site', 'interno']).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('partidas', (t) => {
    t.dropColumn('origem_do_erro');
  });
  await knex.schema.alterTable('torneios', (t) => {
    t.dropColumn('tentar_agora_em');
  });
}
