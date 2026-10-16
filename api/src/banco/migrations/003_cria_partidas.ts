import type { Knex } from 'knex';
import { TEXTO_EXATO as EXATO } from '../colunas';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('partidas', (t) => {
    t.increments('id');
    t.integer('torneio_id').unsigned().notNullable().references('id').inTable('torneios').onDelete('CASCADE');
    t.string('id_partida', 20).collate(EXATO).notNullable();
    t.string('id_partida_planilha', 20).collate(EXATO).notNullable();
    t.integer('rodada').unsigned().notNullable();
    t.date('data').notNullable();
    t.string('time_a', 80).collate(EXATO).notNullable();
    t.string('time_b', 80).collate(EXATO).notNullable();
    t.string('vencedor', 80).collate(EXATO).nullable();

    t.enum('status_conferencia', ['aguardando', 'em_consulta', 'conferida', 'nao_encontrada', 'times_diferentes'])
      .notNullable()
      .defaultTo('aguardando');
    t.integer('tentativas').unsigned().notNullable().defaultTo(0);
    t.dateTime('proxima_tentativa_em').nullable().defaultTo(knex.fn.now());
    t.dateTime('ultima_tentativa_em').nullable();
    t.dateTime('em_consulta_desde').nullable();
    t.string('ultimo_erro', 255).nullable();
    t.timestamps(true, true);

    t.unique(['torneio_id', 'id_partida']);
    t.index(['status_conferencia', 'proxima_tentativa_em'], 'partidas_fila_conferencia');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('partidas');
}
