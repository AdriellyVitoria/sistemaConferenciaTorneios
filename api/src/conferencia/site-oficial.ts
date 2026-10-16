/**
 * Cliente HTTP do site oficial do jogo (etapa 4a).
 *
 * O job da conferência só conhece a interface SiteOficial: trocar o site simulado pelo real,
 * ou a consulta direta por uma fila, não mexe na regra. Cada resposta vira um de três resultados:
 *
 *   encontrada     200 com a partida no formato esperado
 *   nao_encontrada 404: o ID foi digitado errado; só uma correção do ID consulta de novo (D5, D16)
 *   indisponivel   qualquer outra coisa: 503, outro erro do servidor, tempo esgotado, erro de
 *                  rede, resposta fora do formato ou que não fecha (vencedor ou jogador de um
 *                  time que não é da partida, time sem jogador, outra partida). A partida fica "aguardando o site" e é
 *                  tentada de novo (D10). O "detalhe" é a frase que a tela mostra.
 */

import { z } from 'zod';
import type { RespostaSite } from '../dominio/comparacao';
import { LIMITES } from '../dominio/planilha';

export type MotivoIndisponivel =
  | 'site_fora_do_ar' // 503
  | 'erro_do_site' // outro código de erro
  | 'tempo_esgotado' // não respondeu dentro do tempo limite
  | 'erro_de_rede' // nem chegou a conectar (endereço errado, site desligado, DNS)
  | 'resposta_invalida'; // 200, mas fora do formato: não dá para usar dado pela metade

export type ResultadoConsulta = RespostaSite | { status: 'indisponivel'; motivo: MotivoIndisponivel; detalhe: string };

export interface SiteOficial {
  /** idPartida como na planilha, "#40923". */
  consultarPartida(idPartida: string): Promise<ResultadoConsulta>;
}

/**
 * Liga um cronômetro de `ms` milissegundos que chama `aoEsgotar` no fim; devolve a função que
 * o desliga. O padrão usa setTimeout; os testes trocam por um que esgota quando o teste mandar.
 */
export type Cronometro = (ms: number, aoEsgotar: () => void) => () => void;

const cronometroDeVerdade: Cronometro = (ms, aoEsgotar) => {
  const timer = setTimeout(aoEsgotar, ms);
  return () => clearTimeout(timer);
};

export interface OpcoesCliente {
  /** Endereço do site, como "http://localhost:4000". */
  urlBase: string;
  /** Precisa ser maior que a demora máxima do site (10 s): config.SITE_TEMPO_LIMITE_MS. */
  tempoLimiteMs: number;
  cronometro?: Cronometro;
}

// O formato que o site devolve (contexto.md, seção 9). Campos a mais são ignorados.
// Os limites são os mesmos da planilha (R1a): o que passa daqui cabe nas colunas do banco.
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

/** Marca as falhas de coerência, para separá-las das de formato na frase da tela. */
const COERENCIA = { coerencia: true };

/**
 * Code review, item 3: além do formato, a resposta precisa fechar. Sem isso, um vencedor "lobos"
 * (com os times "Lobos" e "Corvos") criava um time fantasma na classificação, e a Maria não teria
 * como corrigir: o site é a verdade (D3). Os nomes são comparados exatamente como o site escreveu.
 */
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
      // o "#" não vai na URL: o navegador e o fetch tratam tudo depois dele como fragmento
      const url = new URL(`/partidas/${encodeURIComponent(idPartida.replace(/^#/, ''))}`, urlBase);
      const controle = new AbortController();
      // o tempo limite cobre a consulta inteira, até o fim do corpo: o site pode travar no meio
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
          // primeiro o formato: com um campo errado, a coerência não diz nada
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

/** O fetch do Node põe o motivo de verdade (ECONNREFUSED, ENOTFOUND...) em erro.cause. */
function descreverErroDeRede(erro: unknown): string {
  const causa = (erro as { cause?: { code?: string; message?: string } })?.cause;
  return causa?.code ?? causa?.message ?? (erro as Error)?.message ?? 'erro desconhecido';
}
