import type { Knex } from 'knex';
import { TEXTO_EXATO as EXATO } from '../colunas';

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
    t.unique(['calculo_id', 'time', 'nick']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('premios_jogador');
  await knex.schema.dropTable('premios_time');
  await knex.schema.dropTable('calculos');
}
