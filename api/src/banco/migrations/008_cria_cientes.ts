import type { Knex } from 'knex';

/**
 * O "Ciente" da Maria em cada pendência (etapa 5a).
 *
 * As pendências em si não são gravadas: saem sempre da comparação atual entre a planilha e o
 * site (D19), então nunca ficam desatualizadas. O que precisa durar é a decisão da Maria, e só
 * ela fica aqui, pela chave da pendência (dominio/chave-pendencia.ts). Uma pendência que mudou
 * tem outra chave: o Ciente antigo simplesmente não se aplica a ela.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cientes', (t) => {
    t.increments('id');
    // planilha nova (D22) apaga os Cientes junto com a conferência; torneio apagado, também
    t.integer('torneio_id').unsigned().notNullable().references('id').inTable('torneios').onDelete('CASCADE');
    // SHA-256 em hexadecimal
    t.specificType('chave', 'char(64)').notNullable();
    t.dateTime('ciente_em', { precision: 3 }).notNullable();
    t.unique(['torneio_id', 'chave']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('cientes');
}
