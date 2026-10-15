import type { Knex } from 'knex';

// Completa a tabela da etapa 0 sem editar a 001, que já rodou.
// - status "criado": o torneio existe antes da planilha ser enviada
// - dados da planilha importada, incluindo se veio convertida de Windows-1252 (D18), para a tela avisar
// - CHECK: prêmio nunca negativo
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('torneios', (t) => {
    t.enum('status', ['criado', 'importado', 'conferindo', 'pronto', 'calculado']).notNullable().defaultTo('criado').alter();
    t.string('planilha_arquivo', 255).nullable().after('calculado_em');
    t.dateTime('planilha_importada_em').nullable().after('planilha_arquivo');
    t.boolean('planilha_convertida_windows1252').notNullable().defaultTo(false).after('planilha_importada_em');
  });
  await knex.raw('ALTER TABLE torneios ADD CONSTRAINT torneios_premio_nao_negativo CHECK (premio_centavos >= 0)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE torneios DROP CHECK torneios_premio_nao_negativo');
  await knex('torneios').where({ status: 'criado' }).update({ status: 'importado' });
  await knex.schema.alterTable('torneios', (t) => {
    t.dropColumn('planilha_convertida_windows1252');
    t.dropColumn('planilha_importada_em');
    t.dropColumn('planilha_arquivo');
    t.enum('status', ['importado', 'conferindo', 'pronto', 'calculado']).notNullable().defaultTo('importado').alter();
  });
}
