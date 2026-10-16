import type { Knex } from 'knex';
import { TEXTO_EXATO as EXATO } from '../colunas';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('participacoes', (t) => {
    t.increments('id');
    t.integer('partida_id').unsigned().notNullable().references('id').inTable('partidas').onDelete('CASCADE');
    t.string('time', 80).collate(EXATO).notNullable();
    t.string('nick', 80).collate(EXATO).notNullable();
    t.integer('minutos').unsigned().notNullable();
    t.integer('kills').unsigned().notNullable();
    t.index(['partida_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('participacoes');
}
