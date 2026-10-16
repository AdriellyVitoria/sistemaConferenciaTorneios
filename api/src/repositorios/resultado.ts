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
  posicao: number;
};

export interface ResultadoGravado extends ConfiguracaoUsada {
  calculadoEm: Date;
  times: TimeGravado[];
  jogadores: JogadorGravado[];
}

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

export async function buscarPorCodigoPublico(bd: Executor, codigo: string): Promise<{ torneioId: number; nome: string } | null> {
  const linha = await bd('calculos as c')
    .join('torneios as t', 't.id', 'c.torneio_id')
    .where('c.codigo_publico', codigo)
    .first('t.id', 't.nome');
  return linha ? { torneioId: linha.id, nome: linha.nome } : null;
}

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
  times: { time: string; posicao: number; premioCentavos: number; codigo: string }[];
}

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

export async function buscarResultado(bd: Executor, torneioId: number): Promise<ResultadoGravado | null> {
  const calculo = await bd('calculos').where({ torneio_id: torneioId }).first();
  if (!calculo) return null;
  const times = await bd('premios_time').where({ calculo_id: calculo.id }).orderBy('ordem');
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
