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
  agora?: () => Date;
  intervalosMs: readonly number[];
  lote: number;
  presaAposMs: number;
}

export interface ResumoRodada {
  recuperadas: number;
  consultadas: number;
  conferidas: number;
  naoEncontradas: number;
  indisponiveis: number;
  descartadas: number;
  erros: number;
}

type Desfecho = 'conferidas' | 'naoEncontradas' | 'indisponiveis' | 'descartadas';

export async function executarRodada({ bd, site, agora = () => new Date(), intervalosMs, lote, presaAposMs }: OpcoesRodada): Promise<ResumoRodada> {
  const resumo: ResumoRodada = { recuperadas: 0, consultadas: 0, conferidas: 0, naoEncontradas: 0, indisponiveis: 0, descartadas: 0, erros: 0 };

  const inicio = agora();
  resumo.recuperadas = await recuperarPresas(bd, { presaAntesDe: new Date(inicio.getTime() - presaAposMs), agora: inicio });

  for (;;) {
    const reservadas = await reservarPartidas(bd, { limite: inicio, agora: agora(), quantidade: lote });
    if (reservadas.length === 0) return resumo;
    resumo.consultadas += reservadas.length;

    const desfechos = await Promise.all(reservadas.map((reserva) => conferirComSeguranca(reserva)));
    for (const desfecho of desfechos) resumo[desfecho]++;
  }

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
      const proximaTentativaEm = proximaTentativa(reserva.reservadaEm, reserva.tentativas + 1, intervalosMs);
      gravou = await gravarIndisponivel(bd, reserva, { proximaTentativaEm, erro: resultado.detalhe });
      desfecho = 'indisponiveis';
    }
    return gravou ? desfecho : 'descartadas';
  }
}

export interface Job {
  parar(): Promise<void>;
}

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
