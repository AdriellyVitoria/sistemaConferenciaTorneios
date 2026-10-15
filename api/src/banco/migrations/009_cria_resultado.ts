import type { Knex } from 'knex';
import { TEXTO_EXATO as EXATO } from '../colunas';

/**
 * O resultado do cálculo, congelado (etapa 6a).
 *
 * - calculos: um por torneio, com a data e a configuração USADA (prêmio, percentuais e modo). É a
 *   foto do momento do cálculo: o que foi pago se explica por ela, mesmo que um dia alguém mude o
 *   torneio no banco.
 * - premios_time: a classificação, com posição, vitórias, kills, prêmio e o critério (D2).
 * - premios_jogador: o valor de cada jogador por time (D13), com minutos, kills, a base usada na
 *   divisão (D1, D21), o centavo de arredondamento (D9) e a explicação para o extrato.
 *
 * Dinheiro em centavos inteiros. Nick e time com collation exata, como no resto do banco.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('calculos', (t) => {
    t.increments('id');
    t.integer('torneio_id').unsigned().notNullable().unique().references('id').inTable('torneios').onDelete('CASCADE');
    t.dateTime('calculado_em', { precision: 3 }).notNullable();
    t.integer('premio_centavos').unsigned().notNullable();
    t.json('percentuais').notNullable();
    t.enum('modo_divisao', ['minutos', 'kills']).notNullable();
  });

  await knex.schema.createTable('premios_time', (t) => {
    t.increments('id');
    t.integer('calculo_id').unsigned().notNullable().references('id').inTable('calculos').onDelete('CASCADE');
    // a ordem da classificação (times empatados têm a mesma posição; a ordem desempata a exibição)
    t.integer('ordem').unsigned().notNullable();
    t.integer('posicao').unsigned().notNullable();
    t.string('time', 80).collate(EXATO).notNullable();
    t.integer('vitorias').unsigned().notNullable();
    t.integer('kills_time').unsigned().notNullable();
    t.integer('premio_centavos').unsigned().notNullable();
    t.string('criterio', 80).nullable();
    t.boolean('recebeu_centavo').notNullable();
    t.unique(['calculo_id', 'time']);
  });

  await knex.schema.createTable('premios_jogador', (t) => {
    t.increments('id');
    t.integer('calculo_id').unsigned().notNullable().references('id').inTable('calculos').onDelete('CASCADE');
    t.string('time', 80).collate(EXATO).notNullable();
    t.string('nick', 80).collate(EXATO).notNullable();
    t.integer('minutos').unsigned().notNullable();
    t.integer('kills').unsigned().notNullable();
    t.integer('base').unsigned().notNullable();
    t.integer('base_time').unsigned().notNullable();
    t.enum('base_usada', ['minutos', 'kills']).notNullable();
    t.integer('premio_centavos').unsigned().notNullable();
    t.boolean('recebeu_centavo').notNullable();
    t.string('explicacao', 255).nullable();
    // um jogador em dois times tem uma linha por time (D13)
    t.unique(['calculo_id', 'time', 'nick']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('premios_jogador');
  await knex.schema.dropTable('premios_time');
  await knex.schema.dropTable('calculos');
}
