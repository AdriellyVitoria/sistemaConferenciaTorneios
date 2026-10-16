import type { Knex } from 'knex';
import type { Executor } from '../banco/conexao';
import { ErroDeRegra } from '../dominio/erro-de-regra';
import { situacaoDoCalculo, type SituacaoDoCalculo } from '../dominio/pronto-para-calcular';
import { montarResultado, type Resultado } from '../dominio/resultado';
import { listarPartidas } from '../repositorios/partidas';
import { buscarResultado, gravarResultado, type ConfiguracaoUsada, type ResultadoGravado } from '../repositorios/resultado';
import { buscarTorneio, buscarTorneioParaAtualizar, marcarCalculado } from '../repositorios/torneios';
import { calcularPendencias, compararAtual } from './pendencias';

export async function montarResultadoDoTorneio(bd: Executor, torneioId: number): Promise<{ config: ConfiguracaoUsada; resultado: Resultado } | null> {
  const torneio = await buscarTorneio(bd, torneioId);
  if (!torneio) return null;
  const { comparacao } = await compararAtual(bd, torneioId);
  const config: ConfiguracaoUsada = {
    premioCentavos: torneio.premioCentavos,
    percentuais: torneio.percentuais,
    modoDivisao: torneio.modoDivisao,
  };
  return { config, resultado: montarResultado({ partidas: comparacao.partidasOficiais, ...config }) };
}

export type ResultadoDoCalculo =
  | { tipo: 'calculado'; resultado: ResultadoGravado }
  | { tipo: 'nao_pode'; calculo: SituacaoDoCalculo }
  | { tipo: 'impossivel'; mensagem: string }
  | { tipo: 'ja_calculado' }
  | { tipo: 'torneio_nao_encontrado' };

export async function calcularTorneio(bd: Knex, torneioId: number, agora = new Date()): Promise<ResultadoDoCalculo> {
  return bd.transaction(async (trx) => {
    const torneio = await buscarTorneioParaAtualizar(trx, torneioId);
    if (!torneio) return { tipo: 'torneio_nao_encontrado' } as const;
    if (torneio.status === 'calculado') return { tipo: 'ja_calculado' } as const;

    const [{ resumo }, partidas] = await Promise.all([calcularPendencias(trx, torneioId), listarPartidas(trx, torneioId)]);
    const calculo = situacaoDoCalculo({
      status: torneio.status,
      calculadoEm: torneio.calculadoEm,
      quantidadeDePartidas: partidas.length,
      aguardandoSite: resumo.aguardandoSite,
      bloqueios: resumo.bloqueantes,
      semCiente: resumo.semCiente,
    });
    if (!calculo.podeCalcular) return { tipo: 'nao_pode', calculo } as const;

    const calculadoEm = new Date(Math.floor(agora.getTime() / 1000) * 1000);
    let montado;
    try {
      montado = (await montarResultadoDoTorneio(trx, torneioId))!;
    } catch (erro) {
      if (erro instanceof ErroDeRegra) return { tipo: 'impossivel', mensagem: erro.message } as const;
      throw erro;
    }
    await gravarResultado(trx, torneioId, montado.config, montado.resultado, calculadoEm);
    await marcarCalculado(trx, torneioId, calculadoEm);
    return { tipo: 'calculado', resultado: (await buscarResultado(trx, torneioId))! } as const;
  });
}
