/** O resultado congelado do cálculo (etapa 6a): gravar e ler. */

import type { Executor } from '../banco/conexao';
import { gerarCodigoDeAcesso } from '../dominio/codigo-de-acesso';
import type { PremioTime } from '../dominio/premio';
import type { ModoDivisao } from '../dominio/rateio';
import type { JogadorDoResultado, Resultado } from '../dominio/resultado';

export interface ConfiguracaoUsada {
  premioCentavos: number;
  percentuais: number[];
  modoDivisao: ModoDivisao;
}

export interface TimeGravado {
  posicao: number;
  time: string;
  vitorias: number;
  killsTime: number;
  premioCentavos: number;
  criterio: string | null;
  recebeuCentavo: boolean;
}

export type JogadorGravado = Pick<
  JogadorDoResultado,
  'time' | 'nick' | 'minutos' | 'kills' | 'base' | 'baseTime' | 'baseUsada' | 'premioCentavos' | 'recebeuCentavo' | 'explicacao'
> & {
  /** A posição do time na classificação do cálculo (vem de premios_time). */
  posicao: number;
};

export interface ResultadoGravado extends ConfiguracaoUsada {
  calculadoEm: Date;
  times: TimeGravado[];
  jogadores: JogadorGravado[];
}

/**
 * Grava o resultado e a configuração usada, com os códigos dos links (D11, 7a): o público e um por
 * time premiado. Se o torneio já tinha um cálculo, ele é substituído (as linhas e os códigos saem
 * junto, pela chave estrangeira). Quem impede um segundo cálculo é a etapa 6b.
 */
export async function gravarResultado(
  bd: Executor,
  torneioId: number,
  config: ConfiguracaoUsada,
  resultado: Resultado,
  calculadoEm: Date,
): Promise<void> {
  await bd('calculos').where({ torneio_id: torneioId }).del();
  const [calculoId] = await bd('calculos').insert({
    torneio_id: torneioId,
    calculado_em: calculadoEm,
    premio_centavos: config.premioCentavos,
    percentuais: JSON.stringify(config.percentuais),
    modo_divisao: config.modoDivisao,
    codigo_publico: gerarCodigoDeAcesso(),
  });

  if (resultado.times.length) {
    await bd('premios_time').insert(
      resultado.times.map((t: PremioTime, ordem) => ({
        calculo_id: calculoId,
        ordem,
        posicao: t.posicao,
        time: t.time,
        vitorias: t.vitorias,
        kills_time: t.killsTime,
        premio_centavos: t.premioCentavos,
        criterio: t.criterio,
        recebeu_centavo: t.recebeuCentavo,
      })),
    );
    // times sem prêmio não recebem código: eles veem a página pública (D11)
    const premiados: { id: number }[] = await bd('premios_time').where({ calculo_id: calculoId }).andWhere('premio_centavos', '>', 0).select('id');
    if (premiados.length) {
      await bd('codigos_time').insert(premiados.map(({ id }) => ({ premio_time_id: id, codigo: gerarCodigoDeAcesso() })));
    }
  }
  if (resultado.jogadores.length) {
    await bd('premios_jogador').insert(
      resultado.jogadores.map((j) => ({
        calculo_id: calculoId,
        time: j.time,
        nick: j.nick,
        minutos: j.minutos,
        kills: j.kills,
        base: j.base,
        base_time: j.baseTime,
        base_usada: j.baseUsada,
        premio_centavos: j.premioCentavos,
        recebeu_centavo: j.recebeuCentavo,
        explicacao: j.explicacao,
      })),
    );
  }
}

/** O torneio do código público, ou null se nenhum cálculo tem esse código. */
export async function buscarPorCodigoPublico(bd: Executor, codigo: string): Promise<{ torneioId: number; nome: string } | null> {
  const linha = await bd('calculos as c')
    .join('torneios as t', 't.id', 'c.torneio_id')
    .where('c.codigo_publico', codigo)
    .first('t.id', 't.nome');
  return linha ? { torneioId: linha.id, nome: linha.nome } : null;
}

/** O time do código, com o torneio e o código público, ou null se nenhum time premiado tem esse código. */
export async function buscarPorCodigoDeTime(
  bd: Executor,
  codigo: string,
): Promise<{ torneioId: number; nome: string; time: string; codigoPublico: string } | null> {
  const linha = await bd('codigos_time as c')
    .join('premios_time as p', 'p.id', 'c.premio_time_id')
    .join('calculos as k', 'k.id', 'p.calculo_id')
    .join('torneios as t', 't.id', 'k.torneio_id')
    .where('c.codigo', codigo)
    .first('t.id', 't.nome', 'p.time', 'k.codigo_publico');
  return linha ? { torneioId: linha.id, nome: linha.nome, time: linha.time, codigoPublico: linha.codigo_publico } : null;
}

export interface CodigosDoTorneio {
  publico: { codigo: string };
  /** Os times premiados, na ordem da classificação. */
  times: { time: string; posicao: number; premioCentavos: number; codigo: string }[];
}

/** Os códigos dos links do torneio, para a Maria copiar, ou null se ainda não foi calculado. */
export async function buscarCodigos(bd: Executor, torneioId: number): Promise<CodigosDoTorneio | null> {
  const calculo = await bd('calculos').where({ torneio_id: torneioId }).first('id', 'codigo_publico');
  if (!calculo) return null;
  const times = await bd('codigos_time as c')
    .join('premios_time as p', 'p.id', 'c.premio_time_id')
    .where('p.calculo_id', calculo.id)
    .orderBy('p.ordem')
    .select('p.time', 'p.posicao', 'p.premio_centavos', 'c.codigo');
  return {
    publico: { codigo: calculo.codigo_publico },
    times: times.map((t) => ({ time: t.time, posicao: t.posicao, premioCentavos: t.premio_centavos, codigo: t.codigo })),
  };
}

/** O resultado gravado do torneio, ou null se ainda não foi calculado. */
export async function buscarResultado(bd: Executor, torneioId: number): Promise<ResultadoGravado | null> {
  const calculo = await bd('calculos').where({ torneio_id: torneioId }).first();
  if (!calculo) return null;
  const times = await bd('premios_time').where({ calculo_id: calculo.id }).orderBy('ordem');
  // os jogadores na ordem dos times da classificação, e por nick dentro do time
  const jogadores = await bd('premios_jogador as j')
    .join('premios_time as t', function ligar() {
      this.on('t.calculo_id', '=', 'j.calculo_id').andOn('t.time', '=', 'j.time');
    })
    .where('j.calculo_id', calculo.id)
    .orderBy([{ column: 't.ordem' }, { column: 'j.id' }])
    .select('j.*', 't.posicao');

  return {
    calculadoEm: calculo.calculado_em,
    premioCentavos: calculo.premio_centavos,
    percentuais: typeof calculo.percentuais === 'string' ? JSON.parse(calculo.percentuais) : calculo.percentuais,
    modoDivisao: calculo.modo_divisao,
    times: times.map((t) => ({
      posicao: t.posicao,
      time: t.time,
      vitorias: t.vitorias,
      killsTime: t.kills_time,
      premioCentavos: t.premio_centavos,
      criterio: t.criterio,
      recebeuCentavo: Boolean(t.recebeu_centavo),
    })),
    jogadores: jogadores.map((j) => ({
      time: j.time,
      posicao: j.posicao,
      nick: j.nick,
      minutos: j.minutos,
      kills: j.kills,
      base: j.base,
      baseTime: j.base_time,
      baseUsada: j.base_usada,
      premioCentavos: j.premio_centavos,
      recebeuCentavo: Boolean(j.recebeu_centavo),
      explicacao: j.explicacao,
    })),
  };
}
