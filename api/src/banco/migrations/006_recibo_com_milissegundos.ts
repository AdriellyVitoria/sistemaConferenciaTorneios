import type { Knex } from 'knex';

/**
 * em_consulta_desde passa a guardar milissegundos (DATETIME(3)). Ele é o recibo da reserva da
 * conferência: a gravação do resultado só vale se o recibo ainda for o mesmo. Em segundos inteiros,
 * duas reservas da mesma partida no mesmo segundo teriam o mesmo recibo, e a consulta antiga
 * poderia gravar por cima da nova.
 */
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
