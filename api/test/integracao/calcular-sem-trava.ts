import type { Knex } from 'knex';
import type { Resultado } from '../../src/dominio/resultado';
import { gravarResultado } from '../../src/repositorios/resultado';
import { montarResultadoDoTorneio } from '../../src/servicos/calculo';

/**
 * SÓ PARA TESTES: monta e grava o resultado sem a trava do torneio e sem conferir se pode calcular.
 * Os testes do 6a usam para checar a montagem e a gravação de um torneio em qualquer situação.
 * O caminho de verdade é calcularTorneio (serviço), que trava, confere e marca o torneio como
 * calculado. Ficava no serviço e foi movido para cá (code review, item 15): exportado de lá, alguém
 * poderia chamá-lo de uma rota e calcular um torneio com pendências.
 */
export async function calcularEGravar(bd: Knex, torneioId: number, agora = new Date()): Promise<Resultado | null> {
  return bd.transaction(async (trx) => {
    const montado = await montarResultadoDoTorneio(trx, torneioId);
    if (!montado) return null;
    await gravarResultado(trx, torneioId, montado.config, montado.resultado, agora);
    return montado.resultado;
  });
}
