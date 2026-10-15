/**
 * Casos de uso do torneio (etapa 3b): criar, consultar, importar a planilha e remover (M2).
 * Orquestra: valida, abre a transação e chama o domínio e os repositórios. Sem HTTP aqui.
 */

import type { Knex } from 'knex';
import { montarPartidas } from '../dominio/importacao';
import { lerPlanilha, type ErroLeitura } from '../dominio/planilha';
import { erroDosPercentuais } from '../dominio/premio';
import { situacaoDoCalculo, type SituacaoDoCalculo } from '../dominio/pronto-para-calcular';
import { segundosParaTentarAgora } from '../dominio/tentar-agora';
import { anteciparAguardando, contarAguardando } from '../repositorios/conferencia';
import { normalizarNome } from '../dominio/texto';
import { apagarCientesDoTorneio, listarParticipacoes, type ParticipacaoGuardada } from '../repositorios/pendencias';
import { calcularPendencias } from './pendencias';
import { inserirLinhas } from '../repositorios/linhas-planilha';
import { apagarPartidasDoTorneio, inserirPartidas, listarPartidas, type Partida } from '../repositorios/partidas';
import {
  apagarTorneio,
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

/** A partida com as kills de cada time segundo o site (5f); null enquanto o site não respondeu. */
export type PartidaComKills = Partida & { killsSite: { timeA: number; timeB: number } | null };

export type TorneioComPartidas = Torneio & { partidas: PartidaComKills[]; segundosParaTentarAgora: number; calculo: SituacaoDoCalculo };

export async function consultarTorneio(bd: Knex, id: number, agora = new Date()): Promise<TorneioComPartidas | null> {
  const torneio = await buscarTorneio(bd, id);
  if (!torneio) return null;
  const [partidas, { resumo }, participacoes] = await Promise.all([listarPartidas(bd, id), calcularPendencias(bd, id), listarParticipacoes(bd, id)]);
  return {
    ...torneio,
    partidas: partidas.map((p) => ({ ...p, killsSite: killsDosTimes(p, participacoes) })),
    // a tela mostra a contagem a partir daqui, sem depender do relógio do navegador
    segundosParaTentarAgora: segundosParaTentarAgora(torneio.tentarAgoraEm, agora),
    // calculado na hora, como as pendências: um Ciente desfeito ou um ID corrigido muda na hora (5c)
    calculo: situacaoDoCalculo({
      status: torneio.status,
      calculadoEm: torneio.calculadoEm,
      quantidadeDePartidas: partidas.length,
      aguardandoSite: resumo.aguardandoSite,
      bloqueios: resumo.bloqueantes,
      semCiente: resumo.semCiente,
    }),
  };
}

/**
 * As kills do time A e do time B da partida (na ordem da planilha), somadas das participações do
 * site. O nome do time é comparado como na D19, sem acentos e maiúsculas: "Falcoes" é Falcões.
 */
function killsDosTimes(partida: Partida, participacoes: ParticipacaoGuardada[]): PartidaComKills['killsSite'] {
  if (partida.statusConferencia !== 'conferida') return null;
  const daPartida = participacoes.filter((j) => j.partidaId === partida.id);
  const soma = (time: string) => daPartida.filter((j) => normalizarNome(j.time) === normalizarNome(time)).reduce((total, j) => total + j.kills, 0);
  return { timeA: soma(partida.timeA), timeB: soma(partida.timeB) };
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

export type ResultadoRemocao = { tipo: 'removido' } | { tipo: 'torneio_nao_encontrado' } | { tipo: 'torneio_calculado' };

/**
 * Remove o torneio que ainda não foi calculado (M2, plano item 9), numa transação só:
 * 1. trava o torneio PRIMEIRO (SELECT ... FOR UPDATE), na mesma ordem das outras gravações
 *    (torneio → partidas → participações, lição do 4b). Dois pedidos de remoção, ou uma remoção e
 *    um cálculo, esperam um pelo outro: o segundo encontra o torneio já removido, ou já calculado;
 * 2. depois do cálculo, recusa: o resultado é o registro do pagamento (e dos links já enviados);
 * 3. apaga as partidas (as linhas da planilha e as participações saem junto, em cascata), os
 *    Cientes e o torneio, como a importação faz ao trocar a planilha (D22).
 * Uma consulta do job em andamento descarta o resultado: ao gravar, ela trava o torneio e confere
 * o recibo da partida, que não existe mais.
 */
export async function removerTorneio(bd: Knex, torneioId: number): Promise<ResultadoRemocao> {
  return bd.transaction(async (trx) => {
    const torneio = await buscarTorneioParaAtualizar(trx, torneioId);
    if (!torneio) return { tipo: 'torneio_nao_encontrado' } as const;
    if (torneio.status === 'calculado') return { tipo: 'torneio_calculado' } as const;

    await apagarPartidasDoTorneio(trx, torneioId);
    await apagarCientesDoTorneio(trx, torneioId);
    await apagarTorneio(trx, torneioId);
    return { tipo: 'removido' } as const;
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
    // a conferência recomeça do zero, e os Cientes dados na planilha anterior também (D22)
    await apagarCientesDoTorneio(trx, torneioId);
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
