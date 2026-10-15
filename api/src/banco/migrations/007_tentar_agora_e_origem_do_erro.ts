import type { Knex } from 'knex';

/**
 * Etapa 4c.
 * - torneios.tentar_agora_em: quando a Maria clicou em "tentar agora" pela última vez. O bloqueio
 *   de 30 s fica no banco, e não na memória da API, para valer depois de a API reiniciar e entre
 *   duas APIs ao mesmo tempo.
 * - partidas.origem_do_erro: de quem foi a última falha, "site" (fora do ar, sem resposta) ou
 *   "interno" (defeito nosso, consulta interrompida). A tela mostra "erro interno, não é o site"
 *   sem precisar adivinhar pelo texto da mensagem.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('torneios', (t) => {
    t.dateTime('tentar_agora_em', { precision: 3 }).nullable();
  });
  await knex.schema.alterTable('partidas', (t) => {
    t.enum('origem_do_erro', ['site', 'interno']).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('partidas', (t) => {
    t.dropColumn('origem_do_erro');
  });
  await knex.schema.alterTable('torneios', (t) => {
    t.dropColumn('tentar_agora_em');
  });
}
