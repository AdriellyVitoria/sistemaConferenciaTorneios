import type { Knex } from 'knex';
import { TEXTO_EXATO as EXATO } from '../colunas';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('linhas_planilha', (t) => {
    t.increments('id');
    t.integer('torneio_id').unsigned().notNullable().references('id').inTable('torneios').onDelete('CASCADE');
    t.integer('partida_id').unsigned().notNullable().references('id').inTable('partidas').onDelete('CASCADE');
    t.integer('numero_linha').unsigned().notNullable();
    t.date('data').notNullable();
    t.integer('rodada').unsigned().notNullable();
    t.string('id_partida', 20).collate(EXATO).notNullable();
    t.string('partida', 200).collate(EXATO).notNullable();
    t.string('time', 80).collate(EXATO).notNullable();
    t.string('nick', 80).collate(EXATO).notNullable();
    t.integer('minutos').unsigned().notNullable();
    t.integer('kills').unsigned().notNullable();
    t.boolean('venceu').nullable();

    t.unique(['torneio_id', 'numero_linha']);
    t.index(['partida_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('linhas_planilha');
}
