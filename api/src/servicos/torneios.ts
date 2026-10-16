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

export async function criarTorneio(bd: Knex, novo: NovoTorneio): Promise<ResultadoCriacao> {
  const erro = erroDosPercentuais(novo.percentuais);
  if (erro) return { ok: false, erros: [{ campo: 'percentuais', mensagem: erro }] };
  return { ok: true, id: await inserirTorneio(bd, novo) };
}

export function listarTorneios(bd: Knex): Promise<ResumoTorneio[]> {
  return buscarTodosOsTorneios(bd);
}

export type PartidaComKills = Partida & { killsSite: { timeA: number; timeB: number } | null };

export type TorneioComPartidas = Torneio & { partidas: PartidaComKills[]; segundosParaTentarAgora: number; calculo: SituacaoDoCalculo };

export async function consultarTorneio(bd: Knex, id: number, agora = new Date()): Promise<TorneioComPartidas | null> {
  const torneio = await buscarTorneio(bd, id);
  if (!torneio) return null;
  const [partidas, { resumo }, participacoes] = await Promise.all([listarPartidas(bd, id), calcularPendencias(bd, id), listarParticipacoes(bd, id)]);
  return {
    ...torneio,
    partidas: partidas.map((p) => ({ ...p, killsSite: killsDosTimes(p, participacoes) })),
    segundosParaTentarAgora: segundosParaTentarAgora(torneio.tentarAgoraEm, agora),
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

export async function importarPlanilha(
  bd: Knex,
  torneioId: number,
  conteudo: Uint8Array,
  arquivo: string,
  agora = new Date(),
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
    await apagarCientesDoTorneio(trx, torneioId);
    const partidaIds = await inserirPartidas(trx, torneioId, montagem.partidas, agora);
    await inserirLinhas(trx, torneioId, leitura.linhas, partidaIds);
    await registrarImportacao(trx, torneioId, { arquivo, convertidoDeWindows1252, agora });

    return {
      tipo: 'importada',
      linhas: leitura.linhas.length,
      partidas: montagem.partidas.length,
      convertidoDeWindows1252,
      substituiuPlanilhaAnterior,
    } as const;
  });
}
