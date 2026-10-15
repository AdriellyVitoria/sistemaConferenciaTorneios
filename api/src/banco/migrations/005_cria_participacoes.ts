import type { Knex } from 'knex';
import { TEXTO_EXATO as EXATO } from '../colunas';

/**
 * O que o site oficial registrou de cada jogador numa partida (etapa 4b). É a fonte da verdade
 * do cálculo (D3); o que a Maria digitou continua em linhas_planilha, e a comparação das duas
 * gera as pendências (etapa 5).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('participacoes', (t) => {
    t.increments('id');
    // a planilha substituída (D22) apaga as partidas, e as participações saem junto
    t.integer('partida_id').unsigned().notNullable().references('id').inTable('partidas').onDelete('CASCADE');
    t.string('time', 80).collate(EXATO).notNullable();
    // como o site registra (xXSniperXx); nunca juntado com a grafia da planilha
    t.string('nick', 80).collate(EXATO).notNullable();
    t.integer('minutos').unsigned().notNullable();
    t.integer('kills').unsigned().notNullable();
    t.index(['partida_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('participacoes');
}
