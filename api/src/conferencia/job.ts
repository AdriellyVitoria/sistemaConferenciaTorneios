/**
 * Job da conferência em segundo plano (etapa 4b). Roda dentro do processo da API: o servidor
 * liga ao subir e desliga ao encerrar. Como a reserva usa SKIP LOCKED, várias APIs (ou um
 * processo separado, no futuro) podem rodar o job ao mesmo tempo sem consultar a mesma partida.
 *
 * Cada rodada:
 *   1. devolve para a fila as partidas presas em "em_consulta" (o processo caiu no meio);
 *   2. reserva um lote de partidas prontas e consulta o lote em paralelo no site;
 *   3. grava cada resultado: conferida, não encontrada (D5) ou indisponível, com a próxima
 *      tentativa agendada (D10). Resultado de partida apagada no meio (D22) é descartado;
 *   4. repete até não haver mais partidas prontas.
 *
 * A comparação com a planilha e as pendências são da etapa 5.
 */

import type { Knex } from 'knex';
import { proximaTentativa } from '../dominio/novas-tentativas';
import {
  devolverAposErro,
  gravarEncontrada,
  gravarIndisponivel,
  gravarNaoEncontrada,
  recuperarPresas,
  reservarPartidas,
  type PartidaReservada,
} from '../repositorios/conferencia';
import type { SiteOficial } from './site-oficial';

export interface OpcoesRodada {
  bd: Knex;
  site: SiteOficial;
  /** O relógio; os testes avançam o tempo sem esperar. */
  agora?: () => Date;
  /** Esperas entre as tentativas (D10): config.CONFERENCIA_INTERVALOS_MS. */
  intervalosMs: readonly number[];
  /** Quantas partidas consultar ao mesmo tempo: config.CONFERENCIA_LOTE. */
  lote: number;
  /** Depois disso em "em_consulta", a partida está presa: config.CONFERENCIA_PRESA_APOS_MS. */
  presaAposMs: number;
}

export interface ResumoRodada {
  recuperadas: number;
  consultadas: number;
  conferidas: number;
  naoEncontradas: number;
  indisponiveis: number;
  /** A partida foi apagada ou recuperada por outra execução enquanto o site respondia. */
  descartadas: number;
  /** Erro do nosso lado numa partida; ela volta para a fila em um intervalo, sem contar tentativa. */
  erros: number;
}

type Desfecho = 'conferidas' | 'naoEncontradas' | 'indisponiveis' | 'descartadas';

export async function executarRodada({ bd, site, agora = () => new Date(), intervalosMs, lote, presaAposMs }: OpcoesRodada): Promise<ResumoRodada> {
  const resumo: ResumoRodada = { recuperadas: 0, consultadas: 0, conferidas: 0, naoEncontradas: 0, indisponiveis: 0, descartadas: 0, erros: 0 };

  // o início da rodada é o limite: uma partida reagendada nesta rodada fica para a próxima
  const inicio = agora();
  resumo.recuperadas = await recuperarPresas(bd, { presaAntesDe: new Date(inicio.getTime() - presaAposMs), agora: inicio });

  for (;;) {
    const reservadas = await reservarPartidas(bd, { limite: inicio, agora: agora(), quantidade: lote });
    if (reservadas.length === 0) return resumo;
    resumo.consultadas += reservadas.length;

    // conferirComSeguranca nunca rejeita: o erro de uma partida não derruba as outras do lote
    const desfechos = await Promise.all(reservadas.map((reserva) => conferirComSeguranca(reserva)));
    for (const desfecho of desfechos) resumo[desfecho]++;
  }

  /**
   * Erro do nosso lado numa partida (defeito, deadlock, gravação recusada): registra no log e
   * devolve a partida para a fila, sem contar tentativa. Se nem isso der (banco fora do ar), ela
   * fica "em_consulta" e a recuperação de partida presa a devolve depois.
   */
  async function conferirComSeguranca(reserva: PartidaReservada): Promise<Desfecho | 'erros'> {
    try {
      return await conferir(reserva);
    } catch (erro) {
      console.error(`Conferência: erro ao conferir a partida ${reserva.idPartida}; ela volta para a fila.`, erro);
      try {
        await devolverAposErro(bd, reserva, { proximaTentativaEm: proximaTentativa(reserva.reservadaEm, 1, intervalosMs) });
      } catch (erroAoDevolver) {
        console.error(`Conferência: não deu para devolver a partida ${reserva.idPartida}; será recuperada depois.`, erroAoDevolver);
      }
      return 'erros';
    }
  }

  async function conferir(reserva: PartidaReservada): Promise<Desfecho> {
    const resultado = await site.consultarPartida(reserva.idPartida);
    let gravou: boolean;
    let desfecho: Desfecho;
    if (resultado.status === 'encontrada') {
      gravou = await gravarEncontrada(bd, reserva, resultado.partida);
      desfecho = 'conferidas';
    } else if (resultado.status === 'nao_encontrada') {
      gravou = await gravarNaoEncontrada(bd, reserva);
      desfecho = 'naoEncontradas';
    } else {
      // a espera conta do início da tentativa, que é o horário que a tela mostra como "última"
      const proximaTentativaEm = proximaTentativa(reserva.reservadaEm, reserva.tentativas + 1, intervalosMs);
      gravou = await gravarIndisponivel(bd, reserva, { proximaTentativaEm, erro: resultado.detalhe });
      desfecho = 'indisponiveis';
    }
    return gravou ? desfecho : 'descartadas';
  }
}

export interface Job {
  /** Para de agendar rodadas e espera a rodada em andamento terminar. */
  parar(): Promise<void>;
}

/**
 * Liga o job: uma rodada agora e, depois do fim de cada uma, outra a cada `acordarACadaMs`.
 * O próximo despertar só é marcado quando a rodada termina, então duas rodadas do mesmo
 * processo nunca se sobrepõem. Um erro numa rodada (banco fora do ar) não derruba o job.
 */
export function iniciarJob(opcoes: OpcoesRodada & { acordarACadaMs: number }): Job {
  let parado = false;
  let timer: NodeJS.Timeout | undefined;
  let rodadaAtual: Promise<void> = Promise.resolve();

  const acordar = () => {
    rodadaAtual = executarRodada(opcoes)
      .then((resumo) => {
        if (resumo.consultadas || resumo.recuperadas) console.log('Conferência:', JSON.stringify(resumo));
      })
      .catch((erro) => console.error('Conferência: a rodada falhou e será tentada de novo.', erro))
      .finally(() => {
        if (!parado) timer = setTimeout(acordar, opcoes.acordarACadaMs);
      });
  };
  acordar();

  return {
    async parar() {
      parado = true;
      clearTimeout(timer);
      await rodadaAtual;
    },
  };
}
