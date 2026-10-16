import type { ErroLeitura, LinhaPlanilha } from './planilha';
import { juntarComE, normalizarNome } from './texto';

export interface PartidaDaPlanilha {
  idPartida: string;
  rodada: number;
  data: string;
  timeA: string;
  timeB: string;
}

export function montarPartidas(linhas: LinhaPlanilha[]):
  | { ok: true; partidas: PartidaDaPlanilha[] }
  | { ok: false; erros: ErroLeitura[] } {
  const partidas: PartidaDaPlanilha[] = [];
  const erros: ErroLeitura[] = [];

  for (const [idPartida, linhasDaPartida] of agruparPorPartida(linhas)) {
    const times = agruparPorTime(linhasDaPartida);
    if (times.length === 2) {
      const [primeira] = linhasDaPartida;
      partidas.push({ idPartida, rodada: primeira.rodada, data: primeira.data, timeA: times[0].nome, timeB: times[1].nome });
    } else {
      erros.push(erroDeTimes(idPartida, times, linhasDaPartida));
    }
  }
  return erros.length ? { ok: false, erros } : { ok: true, partidas };
}

function agruparPorPartida(linhas: LinhaPlanilha[]): Map<string, LinhaPlanilha[]> {
  const grupos = new Map<string, LinhaPlanilha[]>();
  for (const l of linhas) grupos.set(l.idPartida, [...(grupos.get(l.idPartida) ?? []), l]);
  return grupos;
}

function agruparPorTime(linhas: LinhaPlanilha[]): { nome: string; linhas: number[] }[] {
  const times = new Map<string, { nome: string; linhas: number[] }>();
  for (const l of linhas) {
    const chave = normalizarNome(l.time);
    const time = times.get(chave) ?? { nome: l.time, linhas: [] };
    time.linhas.push(l.numeroLinha);
    times.set(chave, time);
  }
  return [...times.values()];
}

const descreverLinhas = (numeros: number[]) =>
  `${numeros.length === 1 ? 'linha' : 'linhas'} ${juntarComE(numeros.map(String))}`;

function erroDeTimes(
  idPartida: string,
  times: { nome: string; linhas: number[] }[],
  linhas: LinhaPlanilha[],
): ErroLeitura {
  const todas = linhas.map((l) => l.numeroLinha).sort((a, b) => a - b);
  const mensagem = times.length === 1
    ? `A partida ${idPartida} tem só o time ${times[0].nome} (${descreverLinhas(times[0].linhas)}). ` +
      'Toda partida precisa ter dois times. Confira o ID.'
    : `A partida ${idPartida} tem ${times.length} times: ` +
      `${juntarComE(times.map((t) => `${t.nome} (${descreverLinhas(t.linhas)})`))}. ` +
      'Toda partida precisa ter dois times. Confira o ID das linhas do time que não é desta partida.';
  return { linha: todas[0], linhas: todas, coluna: 'ID Partida', valor: idPartida, mensagem };
}
