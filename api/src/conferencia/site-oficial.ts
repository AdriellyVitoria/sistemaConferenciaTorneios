import { z } from 'zod';
import type { RespostaSite } from '../dominio/comparacao';
import { LIMITES } from '../dominio/planilha';

export type MotivoIndisponivel =
  | 'site_fora_do_ar'
  | 'erro_do_site'
  | 'tempo_esgotado'
  | 'erro_de_rede'
  | 'resposta_invalida';

export type ResultadoConsulta = RespostaSite | { status: 'indisponivel'; motivo: MotivoIndisponivel; detalhe: string };

export interface SiteOficial {
  consultarPartida(idPartida: string): Promise<ResultadoConsulta>;
}

export type Cronometro = (ms: number, aoEsgotar: () => void) => () => void;

const cronometroDeVerdade: Cronometro = (ms, aoEsgotar) => {
  const timer = setTimeout(aoEsgotar, ms);
  return () => clearTimeout(timer);
};

export interface OpcoesCliente {
  urlBase: string;
  tempoLimiteMs: number;
  cronometro?: Cronometro;
}

const textoAte = (limite: number) =>
  z.string().refine((texto) => [...texto].length <= limite, `passa de ${limite} caracteres`);
const quantidade = z.number().int().nonnegative().max(LIMITES.minutosEKills);
const esquemaPartida = z.object({
  id: z.string(),
  data: z.string(),
  rodada: z.number().int().positive().max(LIMITES.rodada).optional(),
  times: z.tuple([textoAte(LIMITES.time), textoAte(LIMITES.time)]),
  vencedor: textoAte(LIMITES.time),
  jogadores: z.array(z.object({ nick: textoAte(LIMITES.nick), time: textoAte(LIMITES.time), minutos: quantidade, kills: quantidade })),
});

const COERENCIA = { coerencia: true };

function esquemaCoerente(idConsultado: string) {
  return esquemaPartida.superRefine((partida, ctx) => {
    const problema = (mensagem: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message: mensagem, params: COERENCIA });
    const [timeA, timeB] = partida.times;
    const osDois = `${timeA} x ${timeB}`;

    if (partida.id !== idConsultado) problema(`a partida respondida é a ${partida.id}, e não a consultada (${idConsultado})`);
    if (timeA === timeB) {
      problema(`os dois times têm o mesmo nome (${timeA})`);
      return;
    }
    if (!partida.times.includes(partida.vencedor)) {
      problema(`o vencedor "${partida.vencedor}" não é nenhum dos dois times (${osDois})`);
    }
    for (const jogador of partida.jogadores) {
      if (!partida.times.includes(jogador.time)) {
        problema(`o jogador ${jogador.nick} está no time "${jogador.time}", que não é nenhum dos dois times (${osDois})`);
      }
    }
    for (const time of partida.times) {
      if (!partida.jogadores.some((j) => j.time === time)) problema(`o time ${time} não tem nenhum jogador`);
    }
  });
}

export function criarClienteSiteOficial({ urlBase, tempoLimiteMs, cronometro = cronometroDeVerdade }: OpcoesCliente): SiteOficial {
  if (!Number.isSafeInteger(tempoLimiteMs) || tempoLimiteMs <= 0) {
    throw new Error(`O tempo limite da consulta precisa ser milissegundos inteiros e positivos. Veio ${tempoLimiteMs}.`);
  }
  const indisponivel = (motivo: MotivoIndisponivel, detalhe: string): ResultadoConsulta => ({ status: 'indisponivel', motivo, detalhe });

  return {
    async consultarPartida(idPartida) {
      const url = new URL(`/partidas/${encodeURIComponent(idPartida.replace(/^#/, ''))}`, urlBase);
      const controle = new AbortController();
      const desligar = cronometro(tempoLimiteMs, () => controle.abort());
      try {
        const resposta = await fetch(url, { signal: controle.signal, headers: { accept: 'application/json' } });

        if (resposta.status === 404) {
          await resposta.body?.cancel();
          return { status: 'nao_encontrada' };
        }
        if (resposta.status === 503) {
          await resposta.body?.cancel();
          return indisponivel('site_fora_do_ar', 'O site oficial respondeu que está fora do ar (erro 503).');
        }
        if (resposta.status !== 200) {
          await resposta.body?.cancel();
          return indisponivel('erro_do_site', `O site oficial respondeu com o erro ${resposta.status}.`);
        }

        const texto = await resposta.text();
        let corpo: unknown;
        try {
          corpo = JSON.parse(texto);
        } catch {
          return indisponivel('resposta_invalida', 'O site oficial respondeu num formato que o sistema não entende (não é JSON).');
        }
        const partida = esquemaCoerente(idPartida).safeParse(corpo);
        if (!partida.success) {
          const formato = partida.error.issues.filter((i) => !(i.code === 'custom' && i.params?.coerencia));
          if (formato.length > 0) {
            const campos = [...new Set(formato.map((i) => i.path.join('.') || '(resposta)'))].join(', ');
            return indisponivel('resposta_invalida', `O site oficial respondeu fora do formato esperado (campos: ${campos}).`);
          }
          const problemas = partida.error.issues.map((i) => i.message).join('; ');
          return indisponivel('resposta_invalida', `O site oficial respondeu dados que não fecham: ${problemas}.`);
        }
        return { status: 'encontrada', partida: partida.data };
      } catch (erro) {
        if (controle.signal.aborted) {
          return indisponivel('tempo_esgotado', `O site oficial não respondeu em ${formatarSegundos(tempoLimiteMs)}.`);
        }
        return indisponivel('erro_de_rede', `Não foi possível conectar ao site oficial (${descreverErroDeRede(erro)}).`);
      } finally {
        desligar();
      }
    },
  };
}

function formatarSegundos(ms: number): string {
  const segundos = ms / 1000;
  return segundos === 1 ? '1 segundo' : `${String(segundos).replace('.', ',')} segundos`;
}

function descreverErroDeRede(erro: unknown): string {
  const causa = (erro as { cause?: { code?: string; message?: string } })?.cause;
  return causa?.code ?? causa?.message ?? (erro as Error)?.message ?? 'erro desconhecido';
}
