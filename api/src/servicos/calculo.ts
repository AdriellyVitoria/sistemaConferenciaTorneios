/**
 * Cálculo do resultado do torneio (etapa 6a): dos dados do site gravados pelo job (D3) e da
 * configuração do torneio, monta o resultado com o domínio e grava congelado.
 *
 * `calcularTorneio` (etapa 6b) faz tudo numa transação: trava o torneio, confere de novo se
 * pode calcular (D17), monta, grava e marca o torneio como calculado (D1, D22). Assim, dois
 * cliques em "Calcular" ao mesmo tempo não gravam dois resultados.
 */

import type { Knex } from 'knex';
import type { Executor } from '../banco/conexao';
import { ErroDeRegra } from '../dominio/erro-de-regra';
import { situacaoDoCalculo, type SituacaoDoCalculo } from '../dominio/pronto-para-calcular';
import { montarResultado, type Resultado } from '../dominio/resultado';
import { listarPartidas } from '../repositorios/partidas';
import { buscarResultado, gravarResultado, type ConfiguracaoUsada, type ResultadoGravado } from '../repositorios/resultado';
import { buscarTorneio, buscarTorneioParaAtualizar, marcarCalculado } from '../repositorios/torneios';
import { calcularPendencias, compararAtual } from './pendencias';

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

export type ResultadoDoCalculo =
  | { tipo: 'calculado'; resultado: ResultadoGravado }
  | { tipo: 'nao_pode'; calculo: SituacaoDoCalculo }
  /** uma regra de negócio impediu a conta (ErroDeRegra): a frase é para a Maria */
  | { tipo: 'impossivel'; mensagem: string }
  | { tipo: 'ja_calculado' }
  | { tipo: 'torneio_nao_encontrado' };

/**
 * O cálculo da rota (6b), numa transação só:
 * 1. trava o torneio PRIMEIRO (SELECT ... FOR UPDATE), na mesma ordem das outras gravações
 *    (torneio → partidas → participações), para não haver deadlock (lição do 4b). Dois cálculos
 *    ao mesmo tempo esperam um pelo outro, e o segundo encontra o torneio já calculado;
 * 2. confere de novo, aqui dentro, se pode calcular (5c, D17), sem confiar no que a tela viu;
 * 3. monta e grava o resultado (6a) e marca o torneio como calculado (D1, D22).
 */
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

    // a hora em segundos inteiros: torneios.calculado_em guarda segundos (e o MySQL arredondaria a
    // fração), e a data do cálculo precisa ser a mesma nos dois lugares
    const calculadoEm = new Date(Math.floor(agora.getTime() / 1000) * 1000);
    // a montagem vem ANTES de gravar qualquer coisa: com um ErroDeRegra, nada fica pela metade
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
