/**
 * Casos de uso do torneio (etapa 3b): criar, consultar e importar a planilha.
 * Orquestra: valida, abre a transação e chama o domínio e os repositórios. Sem HTTP aqui.
 */

import type { Knex } from 'knex';
import { montarPartidas } from '../dominio/importacao';
import { lerPlanilha, type ErroLeitura } from '../dominio/planilha';
import { erroDosPercentuais } from '../dominio/premio';
import { segundosParaTentarAgora } from '../dominio/tentar-agora';
import { anteciparAguardando, contarAguardando } from '../repositorios/conferencia';
import { inserirLinhas } from '../repositorios/linhas-planilha';
import { apagarPartidasDoTorneio, inserirPartidas, listarPartidas, type Partida } from '../repositorios/partidas';
import {
  buscarTorneio,
  buscarTorneioParaAtualizar,
  criarTorneio as inserirTorneio,
  listarTorneios as buscarTodosOsTorneios,
  registrarImportacao,
  registrarTentarAgora,
  type NovoTorneio,
  type ResumoTorneio,
  type Torneio,
} from '../repositorios/torneios';

export type ResultadoCriacao = { ok: true; id: number } | { ok: false; erros: { campo: string; mensagem: string }[] };

/** Cria o torneio. Os percentuais precisam somar 100 (D20). */
export async function criarTorneio(bd: Knex, novo: NovoTorneio): Promise<ResultadoCriacao> {
  const erro = erroDosPercentuais(novo.percentuais);
  if (erro) return { ok: false, erros: [{ campo: 'percentuais', mensagem: erro }] };
  return { ok: true, id: await inserirTorneio(bd, novo) };
}

export function listarTorneios(bd: Knex): Promise<ResumoTorneio[]> {
  return buscarTodosOsTorneios(bd);
}

export type TorneioComPartidas = Torneio & { partidas: Partida[]; segundosParaTentarAgora: number };

export async function consultarTorneio(bd: Knex, id: number, agora = new Date()): Promise<TorneioComPartidas | null> {
  const torneio = await buscarTorneio(bd, id);
  if (!torneio) return null;
  return {
    ...torneio,
    partidas: await listarPartidas(bd, id),
    // a tela mostra a contagem a partir daqui, sem depender do relógio do navegador
    segundosParaTentarAgora: segundosParaTentarAgora(torneio.tentarAgoraEm, agora),
  };
}

export type ResultadoTentarAgora =
  | { tipo: 'antecipadas'; antecipadas: number; segundosParaTentarAgora: number }
  | { tipo: 'bloqueado'; segundosParaTentarAgora: number }
  | { tipo: 'sem_aguardando' }
  | { tipo: 'torneio_nao_encontrado' }
  | { tipo: 'torneio_calculado' };

/**
 * "Tentar agora" (etapa 4c): antecipa a próxima consulta das partidas aguardando o site.
 * Numa transação, com o torneio travado (SELECT ... FOR UPDATE): dois cliques ao mesmo tempo, ou
 * em duas APIs, esperam um pelo outro, e o segundo encontra o bloqueio de 30 s já gravado.
 * Sem partida aguardando, responde sem começar o bloqueio.
 */
export async function tentarAgora(bd: Knex, torneioId: number, agora = new Date()): Promise<ResultadoTentarAgora> {
  return bd.transaction(async (trx) => {
    const torneio = await buscarTorneioParaAtualizar(trx, torneioId);
    if (!torneio) return { tipo: 'torneio_nao_encontrado' } as const;
    if (torneio.status === 'calculado') return { tipo: 'torneio_calculado' } as const;

    const faltam = segundosParaTentarAgora(torneio.tentarAgoraEm, agora);
    if (faltam > 0) return { tipo: 'bloqueado', segundosParaTentarAgora: faltam } as const;
    if ((await contarAguardando(trx, torneioId)) === 0) return { tipo: 'sem_aguardando' } as const;

    const antecipadas = await anteciparAguardando(trx, torneioId, agora);
    await registrarTentarAgora(trx, torneioId, agora);
    return { tipo: 'antecipadas', antecipadas, segundosParaTentarAgora: segundosParaTentarAgora(agora, agora) } as const;
  });
}

export type ResultadoImportacao =
  | { tipo: 'importada'; linhas: number; partidas: number; convertidoDeWindows1252: boolean; substituiuPlanilhaAnterior: boolean }
  | { tipo: 'invalida'; erros: ErroLeitura[]; convertidoDeWindows1252: boolean }
  | { tipo: 'torneio_nao_encontrado' }
  | { tipo: 'torneio_calculado' };

/**
 * Importa a planilha do torneio.
 * - Lê e valida tudo antes de tocar no banco (D18, D23): com qualquer erro, recusa o arquivo inteiro
 *   e a planilha que já estava lá continua intacta.
 * - Numa transação, com o torneio travado: apaga a planilha anterior, se houver (D22), cria uma
 *   partida por ID, "aguardando" o site, e guarda as linhas como foram digitadas.
 * - Depois do cálculo, a planilha fica travada (D22).
 */
export async function importarPlanilha(
  bd: Knex,
  torneioId: number,
  conteudo: Uint8Array,
  arquivo: string,
): Promise<ResultadoImportacao> {
  const leitura = lerPlanilha(conteudo);
  const { convertidoDeWindows1252 } = leitura;
  if (!leitura.ok) return { tipo: 'invalida', erros: leitura.erros, convertidoDeWindows1252 };

  const montagem = montarPartidas(leitura.linhas);
  if (!montagem.ok) return { tipo: 'invalida', erros: montagem.erros, convertidoDeWindows1252 };

  return bd.transaction(async (trx) => {
    const torneio = await buscarTorneioParaAtualizar(trx, torneioId);
    if (!torneio) return { tipo: 'torneio_nao_encontrado' } as const;
    if (torneio.status === 'calculado') return { tipo: 'torneio_calculado' } as const;

    const substituiuPlanilhaAnterior = (await apagarPartidasDoTorneio(trx, torneioId)) > 0;
    const partidaIds = await inserirPartidas(trx, torneioId, montagem.partidas);
    await inserirLinhas(trx, torneioId, leitura.linhas, partidaIds);
    await registrarImportacao(trx, torneioId, { arquivo, convertidoDeWindows1252 });

    return {
      tipo: 'importada',
      linhas: leitura.linhas.length,
      partidas: montagem.partidas.length,
      convertidoDeWindows1252,
      substituiuPlanilhaAnterior,
    } as const;
  });
}
