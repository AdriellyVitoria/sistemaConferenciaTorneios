import type { Executor } from '../banco/conexao';
import type { ModoDivisao } from '../dominio/rateio';

export type StatusTorneio = 'criado' | 'importado' | 'conferindo' | 'pronto' | 'calculado';

export interface NovoTorneio {
  nome: string;
  /** Sempre em centavos inteiros: R$ 10.000,00 = 1000000. */
  premioCentavos: number;
  /** Por posição, somando 100 (D20): [50, 30, 20]. Validados antes de chegar aqui. */
  percentuais: number[];
  /** Escolhido antes da planilha e travado depois do cálculo (D1). */
  modoDivisao: ModoDivisao;
}

export interface Torneio extends NovoTorneio {
  id: number;
  status: StatusTorneio;
  calculadoEm: Date | null;
  planilhaArquivo: string | null;
  planilhaImportadaEm: Date | null;
  /** A planilha não era UTF-8 e foi convertida de Windows-1252 (D18): a tela avisa. */
  planilhaConvertidaDeWindows1252: boolean;
  /** O último clique em "tentar agora", para o bloqueio de 30 s (etapa 4c). */
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

/** Um torneio na lista da página inicial. */
export interface ResumoTorneio extends Torneio {
  quantidadeDePartidas: number;
  /** A data da primeira partida da planilha ('aaaa-mm-dd'), ou null sem planilha: a lista agrupa por mês. */
  primeiraPartidaEm: string | null;
}

/** Todos os torneios, o mais novo primeiro, com quantas partidas cada um tem e a data da primeira. */
export async function listarTorneios(bd: Executor): Promise<ResumoTorneio[]> {
  const linhas: (LinhaTorneio & { quantidade_de_partidas: number | string; primeira_partida_em: string | null })[] = await bd('torneios as t')
    .select('t.*')
    .select(
      bd('partidas as p').count('*').where('p.torneio_id', bd.ref('t.id')).as('quantidade_de_partidas'),
      // a menor data das linhas da planilha: o que a Maria digitou (D22: planilha nova, data nova)
      bd('linhas_planilha as l').min('l.data').where('l.torneio_id', bd.ref('t.id')).as('primeira_partida_em'),
    )
    .orderBy('t.id', 'desc');
  return linhas.map((l) => ({
    ...paraTorneio(l),
    quantidadeDePartidas: Number(l.quantidade_de_partidas),
    primeiraPartidaEm: l.primeira_partida_em,
  }));
}

/**
 * Busca o torneio TRAVANDO a linha até o fim da transação (SELECT ... FOR UPDATE).
 * Usado pela importação: dois envios ao mesmo tempo esperam um pelo outro, sem misturar planilhas.
 */
export async function buscarTorneioParaAtualizar(trx: Executor, id: number): Promise<Torneio | null> {
  const linha: LinhaTorneio | undefined = await trx('torneios').where({ id }).forUpdate().first();
  return linha ? paraTorneio(linha) : null;
}

/** Marca o torneio como importado e guarda de onde veio a planilha. */
export async function registrarImportacao(
  bd: Executor,
  id: number,
  { arquivo, convertidoDeWindows1252 }: { arquivo: string; convertidoDeWindows1252: boolean },
): Promise<void> {
  await bd('torneios').where({ id }).update({
    status: 'importado',
    planilha_arquivo: arquivo,
    planilha_importada_em: bd.fn.now(),
    planilha_convertida_windows1252: convertidoDeWindows1252,
  });
}

/**
 * Marca o torneio como calculado (6b). Daqui em diante, o modo de divisão e a planilha ficam
 * travados (D1, D22), e todas as gravações que mudam a conferência respondem 409.
 */
export async function marcarCalculado(bd: Executor, id: number, calculadoEm: Date): Promise<void> {
  await bd('torneios').where({ id }).update({ status: 'calculado', calculado_em: calculadoEm });
}

/** Apaga a linha do torneio (M2). Quem apaga as partidas e os Cientes antes, na ordem das travas, é o serviço. */
export async function apagarTorneio(bd: Executor, id: number): Promise<void> {
  await bd('torneios').where({ id }).del();
}

/** Guarda o clique em "tentar agora": começa o bloqueio de 30 s (etapa 4c). */
export async function registrarTentarAgora(bd: Executor, id: number, agora: Date): Promise<void> {
  await bd('torneios').where({ id }).update({ tentar_agora_em: agora });
}

function paraTorneio(linha: LinhaTorneio): Torneio {
  return {
    id: linha.id,
    nome: linha.nome,
    premioCentavos: linha.premio_centavos,
    // o mysql2 já devolve a coluna JSON convertida; o texto fica de reserva
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
