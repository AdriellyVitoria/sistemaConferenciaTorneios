import type { Executor } from '../banco/conexao';
import type { ModoDivisao } from '../dominio/rateio';
import { emSegundosInteiros } from './conferencia';

export type StatusTorneio = 'criado' | 'importado' | 'conferindo' | 'pronto' | 'calculado';

export interface NovoTorneio {
  nome: string;
  premioCentavos: number;
  percentuais: number[];
  modoDivisao: ModoDivisao;
}

export interface Torneio extends NovoTorneio {
  id: number;
  status: StatusTorneio;
  calculadoEm: Date | null;
  planilhaArquivo: string | null;
  planilhaImportadaEm: Date | null;
  planilhaConvertidaDeWindows1252: boolean;
  tentarAgoraEm: Date | null;
  criadoEm: Date;
}

interface LinhaTorneio {
  id: number;
  nome: string;
  premio_centavos: number;
  percentuais: number[] | string;
  modo_divisao: ModoDivisao;
  status: StatusTorneio;
  calculado_em: Date | null;
  planilha_arquivo: string | null;
  planilha_importada_em: Date | null;
  planilha_convertida_windows1252: number;
  tentar_agora_em: Date | null;
  created_at: Date;
}

export async function criarTorneio(bd: Executor, novo: NovoTorneio): Promise<number> {
  const [id] = await bd('torneios').insert({
    nome: novo.nome,
    premio_centavos: novo.premioCentavos,
    percentuais: JSON.stringify(novo.percentuais),
    modo_divisao: novo.modoDivisao,
  });
  return id;
}

export async function buscarTorneio(bd: Executor, id: number): Promise<Torneio | null> {
  const linha: LinhaTorneio | undefined = await bd('torneios').where({ id }).first();
  return linha ? paraTorneio(linha) : null;
}

export interface ResumoTorneio extends Torneio {
  quantidadeDePartidas: number;
  primeiraPartidaEm: string | null;
}

export async function listarTorneios(bd: Executor): Promise<ResumoTorneio[]> {
  const linhas: (LinhaTorneio & { quantidade_de_partidas: number | string; primeira_partida_em: string | null })[] = await bd('torneios as t')
    .select('t.*')
    .select(
      bd('partidas as p').count('*').where('p.torneio_id', bd.ref('t.id')).as('quantidade_de_partidas'),
      bd('linhas_planilha as l').min('l.data').where('l.torneio_id', bd.ref('t.id')).as('primeira_partida_em'),
    )
    .orderBy('t.id', 'desc');
  return linhas.map((l) => ({
    ...paraTorneio(l),
    quantidadeDePartidas: Number(l.quantidade_de_partidas),
    primeiraPartidaEm: l.primeira_partida_em,
  }));
}

export async function buscarTorneioParaAtualizar(trx: Executor, id: number): Promise<Torneio | null> {
  const linha: LinhaTorneio | undefined = await trx('torneios').where({ id }).forUpdate().first();
  return linha ? paraTorneio(linha) : null;
}

export async function registrarImportacao(
  bd: Executor,
  id: number,
  { arquivo, convertidoDeWindows1252, agora }: { arquivo: string; convertidoDeWindows1252: boolean; agora: Date },
): Promise<void> {
  await bd('torneios').where({ id }).update({
    status: 'importado',
    planilha_arquivo: arquivo,
    planilha_importada_em: emSegundosInteiros(agora),
    planilha_convertida_windows1252: convertidoDeWindows1252,
  });
}

export async function marcarCalculado(bd: Executor, id: number, calculadoEm: Date): Promise<void> {
  await bd('torneios').where({ id }).update({ status: 'calculado', calculado_em: calculadoEm });
}

export async function apagarTorneio(bd: Executor, id: number): Promise<void> {
  await bd('torneios').where({ id }).del();
}

export async function registrarTentarAgora(bd: Executor, id: number, agora: Date): Promise<void> {
  await bd('torneios').where({ id }).update({ tentar_agora_em: agora });
}

function paraTorneio(linha: LinhaTorneio): Torneio {
  return {
    id: linha.id,
    nome: linha.nome,
    premioCentavos: linha.premio_centavos,
    percentuais: typeof linha.percentuais === 'string' ? JSON.parse(linha.percentuais) : linha.percentuais,
    modoDivisao: linha.modo_divisao,
    status: linha.status,
    calculadoEm: linha.calculado_em,
    planilhaArquivo: linha.planilha_arquivo,
    planilhaImportadaEm: linha.planilha_importada_em,
    planilhaConvertidaDeWindows1252: Boolean(linha.planilha_convertida_windows1252),
    tentarAgoraEm: linha.tentar_agora_em,
    criadoEm: linha.created_at,
  };
}
