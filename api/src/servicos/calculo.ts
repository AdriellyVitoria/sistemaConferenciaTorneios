/**
 * Cálculo do resultado do torneio (etapa 6a): dos dados do site gravados pelo job (D3) e da
 * configuração do torneio, monta o resultado com o domínio e grava congelado.
 *
 * Fica para a etapa 6b: a rota, a trava (só calcular quando pode, D17, e travar o torneio
 * depois, D1, D22) e a concorrência (dois cliques em "Calcular" ao mesmo tempo). Por isso as
 * duas peças são separadas: a 6b as chama dentro da sua transação, com o torneio travado.
 */

import type { Knex } from 'knex';
import type { Executor } from '../banco/conexao';
import { montarResultado, type Resultado } from '../dominio/resultado';
import { gravarResultado, type ConfiguracaoUsada } from '../repositorios/resultado';
import { buscarTorneio } from '../repositorios/torneios';
import { compararAtual } from './pendencias';

/**
 * Monta o resultado com os dados oficiais da comparação atual: só as partidas encontradas no site
 * e com os times certos (as mesmas que a Maria revisou), com os nicks e os números do site.
 */
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

/** Calcula e grava o resultado, numa transação: ou grava tudo, ou nada. */
export async function calcularEGravar(bd: Knex, torneioId: number, agora = new Date()): Promise<Resultado | null> {
  return bd.transaction(async (trx) => {
    const montado = await montarResultadoDoTorneio(trx, torneioId);
    if (!montado) return null;
    await gravarResultado(trx, torneioId, montado.config, montado.resultado, agora);
    return montado.resultado;
  });
}
