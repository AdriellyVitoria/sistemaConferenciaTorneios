import type { Knex } from 'knex';
import type { Resultado } from '../../src/dominio/resultado';
import { gravarResultado } from '../../src/repositorios/resultado';
import { montarResultadoDoTorneio } from '../../src/servicos/calculo';

export async function calcularEGravar(bd: Knex, torneioId: number, agora = new Date()): Promise<Resultado | null> {
  return bd.transaction(async (trx) => {
    const montado = await montarResultadoDoTorneio(trx, torneioId);
    if (!montado) return null;
    await gravarResultado(trx, torneioId, montado.config, montado.resultado, agora);
    return montado.resultado;
  });
}
