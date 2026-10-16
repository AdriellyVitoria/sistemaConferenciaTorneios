import type { ErroPlanilha, ModoDivisao, Partida, StatusConferencia, StatusTorneio, Torneio } from '../servicos/api';

export type EnvioDaPlanilha = 'primeira' | 'substituir' | 'travada';

export function envioDaPlanilha(torneio: Pick<Torneio, 'status' | 'planilhaArquivo'>): EnvioDaPlanilha {
  if (torneio.status === 'calculado') return 'travada';
  return torneio.planilhaArquivo === null ? 'primeira' : 'substituir';
}

export function rotuloDoId(partida: Pick<Partida, 'idPartida' | 'idPartidaPlanilha'>): string {
  return partida.idPartidaPlanilha === partida.idPartida
    ? partida.idPartida
    : `${partida.idPartidaPlanilha} → ${partida.idPartida} (corrigido)`;
}

export function linhasDoErro(erro: ErroPlanilha): string {
  if (erro.linhas?.length) return erro.linhas.join(', ');
  return erro.linha === undefined ? '—' : String(erro.linha);
}

export function formatarDataDeCriacao(iso: string, fuso?: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: fuso }).format(new Date(iso));
}

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
