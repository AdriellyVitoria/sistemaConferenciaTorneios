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
    criadoEm: linha.created_at,
  };
}
