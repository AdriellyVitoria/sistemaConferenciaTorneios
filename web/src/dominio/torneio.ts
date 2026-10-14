/** Regras e textos da tela do torneio, sem Vue nem HTTP, para serem testados sozinhos. */

import type { ErroPlanilha, ModoDivisao, StatusConferencia, StatusTorneio, Torneio } from '../servicos/api';

export type EnvioDaPlanilha = 'primeira' | 'substituir' | 'travada';

/**
 * D22: enquanto o torneio não foi calculado, a planilha pode ser enviada de novo, e a nova
 * substitui a anterior inteira; a tela pede confirmação. Depois do cálculo, não pode mais.
 */
export function envioDaPlanilha(torneio: Pick<Torneio, 'status' | 'planilhaArquivo'>): EnvioDaPlanilha {
  if (torneio.status === 'calculado') return 'travada';
  return torneio.planilhaArquivo === null ? 'primeira' : 'substituir';
}

/** As linhas do Excel onde procurar o erro: todas, quando o problema é de uma partida inteira (D23). */
export function linhasDoErro(erro: ErroPlanilha): string {
  if (erro.linhas?.length) return erro.linhas.join(', ');
  return erro.linha === undefined ? '—' : String(erro.linha);
}

/** "2026-09-19" -> "19/09/2026". Só texto: como Date, o dia poderia mudar com o fuso. */
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

const MODOS: Record<ModoDivisao, string> = {
  minutos: 'Divisão por minutos jogados',
  kills: 'Divisão por kills',
};

const STATUS: Record<StatusTorneio, string> = {
  criado: 'Aguardando a planilha',
  importado: 'Planilha importada',
  conferindo: 'Conferindo no site',
  pronto: 'Pronto para calcular',
  calculado: 'Calculado',
};

const CONFERENCIA: Record<StatusConferencia, string> = {
  aguardando: 'Aguardando o site',
  em_consulta: 'Consultando o site',
  conferida: 'Conferida',
  nao_encontrada: 'Não encontrada no site',
  times_diferentes: 'Times diferentes no site',
};

export const rotuloDoModo = (modo: ModoDivisao) => MODOS[modo];
export const rotuloDoStatus = (status: StatusTorneio) => STATUS[status];
export const rotuloDaConferencia = (status: StatusConferencia) => CONFERENCIA[status];
