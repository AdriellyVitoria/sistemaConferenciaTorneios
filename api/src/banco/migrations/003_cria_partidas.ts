import type { Knex } from 'knex';
import { TEXTO_EXATO as EXATO } from '../colunas';

/**
 * Partidas do torneio. É também a TABELA DE TAREFAS da conferência (etapa 4): o job busca as
 * partidas "aguardando" cuja próxima tentativa já chegou, reserva com SELECT ... FOR UPDATE
 * SKIP LOCKED e marca "em_consulta".
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('partidas', (t) => {
    t.increments('id');
    t.integer('torneio_id').unsigned().notNullable().references('id').inTable('torneios').onDelete('CASCADE');
    // o ID consultado no site; é a única coisa que a Maria pode corrigir (D16)
    t.string('id_partida', 20).collate(EXATO).notNullable();
    // o ID como veio na planilha, para histórico
    t.string('id_partida_planilha', 20).collate(EXATO).notNullable();
    t.integer('rodada').unsigned().notNullable();
    t.date('data').notNullable();
    t.string('time_a', 80).collate(EXATO).notNullable();
    t.string('time_b', 80).collate(EXATO).notNullable();
    // segundo o site, depois da conferência
    t.string('vencedor', 80).collate(EXATO).nullable();

    // ---- conferência (tabela de tarefas)
    t.enum('status_conferencia', ['aguardando', 'em_consulta', 'conferida', 'nao_encontrada', 'times_diferentes'])
      .notNullable()
      .defaultTo('aguardando');
    t.integer('tentativas').unsigned().notNullable().defaultTo(0);
    // nasce "agora": a primeira consulta pode acontecer assim que a planilha é importada
    t.dateTime('proxima_tentativa_em').nullable().defaultTo(knex.fn.now());
    t.dateTime('ultima_tentativa_em').nullable();
    // quando foi reservada; permite recuperar uma partida presa se o job cair no meio da consulta
    t.dateTime('em_consulta_desde').nullable();
    // para a tela mostrar o motivo da última falha ("site fora do ar", "tempo esgotado")
    t.string('ultimo_erro', 255).nullable();
    t.timestamps(true, true);

    t.unique(['torneio_id', 'id_partida']);
    // a consulta do job: status + próxima tentativa
    t.index(['status_conferencia', 'proxima_tentativa_em'], 'partidas_fila_conferencia');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('partidas');
}
