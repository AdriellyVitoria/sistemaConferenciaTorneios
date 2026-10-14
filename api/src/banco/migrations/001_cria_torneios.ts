import type { Knex } from 'knex';

// Primeira tabela do esquema (plano.md, seção 5). As demais entram na etapa 3.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('torneios', (t) => {
    t.increments('id');
    t.string('nome', 120).notNullable();
    // dinheiro sempre em centavos inteiros: R$ 10.000,00 = 1000000
    t.integer('premio_centavos').unsigned().notNullable();
    // percentuais por posição, ex.: [50, 30, 20]
    t.json('percentuais').notNullable();
    t.enum('modo_divisao', ['minutos', 'kills']).notNullable();
    t.enum('status', ['importado', 'conferindo', 'pronto', 'calculado']).notNullable().defaultTo('importado');
    // depois do cálculo, o modo de divisão não pode mais mudar (D1)
    t.dateTime('calculado_em').nullable();
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('torneios');
}
