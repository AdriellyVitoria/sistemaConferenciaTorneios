/**
 * Comparação da planilha com o site oficial (etapa 1, parte 2).
 *
 * Função pura: recebe as linhas lidas da planilha e o que o site respondeu para cada partida, e
 * devolve (a) os itens da aba Pendências e (b) os dados oficiais que o cálculo vai usar, que são
 * sempre os do site (D3). Cada problema vira UM item (D17), na ordem de prioridade das regras.
 */

import type { LinhaPlanilha } from './planilha';
import { juntarComE, normalizarNome } from './texto';

export interface JogadorSite {
  nick: string;
  time: string;
  minutos: number;
  kills: number;
}

export interface PartidaSite {
  id: string;
  data: string;
  rodada?: number;
  times: [string, string];
  vencedor: string;
  jogadores: JogadorSite[];
}

/** Partida sem resposta (undefined) = o site ainda não respondeu: fica em "Aguardando o site". */
export type RespostaSite = { status: 'encontrada'; partida: PartidaSite } | { status: 'nao_encontrada' };

export type TipoPendencia =
  | 'nao_encontrada'
  | 'times_diferentes'
  | 'sem_dados_planilha'
  | 'duplicata'
  | 'nick_diferente'
  | 'divergencia'
  | 'jogador_so_na_planilha'
  | 'jogador_so_no_site'
  | 'time_escrito_diferente'
  | 'jogador_dois_times';

export interface ItemPendencia {
  tipo: TipoPendencia;
  /** null quando o item é do torneio todo (jogador em dois times, nome de time). */
  idPartida: string | null;
  /** Partidas envolvidas, para itens do torneio todo. */
  partidas?: string[];
  /** Nick como o site registra (ou como está na planilha, se o site não tem o jogador). */
  nick?: string;
  campo?: 'vencedor' | 'minutos' | 'kills' | 'time';
  valorPlanilha: string | null;
  valorSite: string | null;
  /** D17: todo item precisa de "Ciente" ou de correção do ID antes do cálculo. */
  acao: 'ciente' | 'corrigir_id';
  mensagem: string;
}

export interface ResultadoComparacao {
  pendencias: ItemPendencia[];
  /** O que o cálculo usa: só partidas encontradas no site e com os times certos. */
  partidasOficiais: PartidaSite[];
  /** Partidas que o site ainda não respondeu. */
  aguardandoSite: string[];
}

export function compararComSite(
  linhas: LinhaPlanilha[],
  respostas: Record<string, RespostaSite | undefined>,
): ResultadoComparacao {
  const pendencias: ItemPendencia[] = [];
  const partidasOficiais: PartidaSite[] = [];
  const aguardandoSite: string[] = [];
  const grafiasDeTime = new Map<string, { planilha: Set<string>; site: string; partidas: string[] }>();

  for (const [idPartida, linhasDaPartida] of agruparPorPartida(linhas)) {
    const resposta = respostas[idPartida];

    if (!resposta) {
      aguardandoSite.push(idPartida);
      continue;
    }

    // Regra 1: o site não conhece o ID
    if (resposta.status === 'nao_encontrada') {
      pendencias.push({
        tipo: 'nao_encontrada', idPartida, valorPlanilha: idPartida, valorSite: null, acao: 'corrigir_id',
        mensagem: `O site não encontrou a partida ${idPartida}. Confira o ID na planilha e corrija.`,
      });
      continue;
    }

    const site = resposta.partida;
    const timesPlanilha = timesNaOrdem(linhasDaPartida);

    // Regra 2: o ID é, no site, uma partida de outros times. Nenhum outro item dessa partida.
    if (!mesmosTimes(timesPlanilha, site.times)) {
      const planilha = timesPlanilha.join(' x ');
      const noSite = site.times.join(' x ');
      pendencias.push({
        tipo: 'times_diferentes', idPartida, valorPlanilha: planilha, valorSite: noSite, acao: 'corrigir_id',
        mensagem: `No site, a partida ${idPartida} é ${noSite}, mas na planilha está ${planilha}. O ID deve estar errado: corrija.`,
      });
      continue;
    }

    partidasOficiais.push(site);
    anotarGrafiasDeTime(grafiasDeTime, timesPlanilha, site, idPartida);

    // Regra 3: partida zerada na planilha; o site preenche (D3). Um item só, não um por jogador.
    if (linhasDaPartida.every((l) => l.minutos === 0 && l.kills === 0 && l.venceu === null)) {
      pendencias.push({
        tipo: 'sem_dados_planilha', idPartida, valorPlanilha: 'sem dados', valorSite: `${site.vencedor} venceu`, acao: 'ciente',
        mensagem: `A partida ${idPartida} está sem dados na planilha (0 minutos, 0 kills e sem vencedor). Usamos os dados do site: ${site.vencedor} venceu.`,
      });
      continue;
    }

    pendencias.push(...compararJogadores(idPartida, linhasDaPartida, site));
    pendencias.push(...compararVencedor(idPartida, linhasDaPartida, site));
  }

  pendencias.push(...itensDeGrafiaDeTime(grafiasDeTime));
  pendencias.push(...jogadoresEmDoisTimes(partidasOficiais));
  return { pendencias, partidasOficiais, aguardandoSite };
}

// ----------------------------------------------------------------- partida

function agruparPorPartida(linhas: LinhaPlanilha[]): Map<string, LinhaPlanilha[]> {
  const grupos = new Map<string, LinhaPlanilha[]>();
  for (const l of linhas) grupos.set(l.idPartida, [...(grupos.get(l.idPartida) ?? []), l]);
  return grupos;
}

/** Times da partida como aparecem na planilha, na ordem da primeira aparição. */
function timesNaOrdem(linhas: LinhaPlanilha[]): string[] {
  const vistos = new Map<string, string>();
  for (const l of linhas) if (!vistos.has(normalizarNome(l.time))) vistos.set(normalizarNome(l.time), l.time);
  return [...vistos.values()];
}

/** Compara os times ignorando acentos e maiúsculas: "serpentes" é Serpentes, não outro time. */
function mesmosTimes(planilha: string[], site: string[]): boolean {
  const a = planilha.map(normalizarNome).sort();
  const b = site.map(normalizarNome).sort();
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

// ----------------------------------------------------------------- jogadores

const descrever = (minutos: number, kills: number) => `${minutos} min, ${kills} kills`;

/** Regras 4 a 7: duplicata, nick, valores e jogador só de um lado. */
function compararJogadores(idPartida: string, linhas: LinhaPlanilha[], site: PartidaSite): ItemPendencia[] {
  const itens: ItemPendencia[] = [];
  const doSite = new Map(site.jogadores.map((j) => [normalizarNome(j.nick), j]));
  const encontrados = new Set<string>();

  // agrupa pelo nick normalizado: "xxsniperxx" e "xXSniperXx" são o mesmo jogador
  const porNick = new Map<string, LinhaPlanilha[]>();
  for (const l of linhas) porNick.set(normalizarNome(l.nick), [...(porNick.get(normalizarNome(l.nick)) ?? []), l]);

  for (const [chave, linhasDoNick] of porNick) {
    const jogador = doSite.get(chave);
    const nick = jogador?.nick ?? linhasDoNick[0].nick;
    if (jogador) encontrados.add(chave);

    // Regra 4: duplicata. Um item só, com as linhas da planilha e o valor do site; sem itens de valor.
    if (linhasDoNick.length > 1) {
      const numeros = juntarComE(linhasDoNick.map((l) => String(l.numeroLinha)));
      itens.push({
        tipo: 'duplicata', idPartida, nick, acao: 'ciente',
        valorPlanilha: `${linhasDoNick.length} vezes: ${linhasDoNick.map((l) => descrever(l.minutos, l.kills)).join(' / ')}`,
        valorSite: jogador ? descrever(jogador.minutos, jogador.kills) : null,
        mensagem: `${nick} aparece ${linhasDoNick.length} vezes na partida ${idPartida} (linhas ${numeros}). `
          + (jogador ? 'No site aparece uma vez; usamos os dados do site.' : 'O site não registra esse jogador.'),
      });
    }

    // Regra 7 (lado da planilha): o site não registra esse jogador
    if (!jogador) {
      const l = linhasDoNick[0];
      itens.push({
        tipo: 'jogador_so_na_planilha', idPartida, nick, acao: 'ciente',
        valorPlanilha: descrever(l.minutos, l.kills), valorSite: null,
        mensagem: `${nick} está na planilha na partida ${idPartida}, mas o site não registra esse jogador. Ele não entra no cálculo dessa partida.`,
      });
      continue;
    }

    // Regra 5: nick escrito diferente; depois compara os valores com esse jogador
    const grafia = linhasDoNick.find((l) => l.nick !== jogador.nick);
    if (grafia) {
      itens.push({
        tipo: 'nick_diferente', idPartida, nick, valorPlanilha: grafia.nick, valorSite: jogador.nick, acao: 'ciente',
        mensagem: `Na partida ${idPartida}, o nick está escrito "${grafia.nick}" na planilha e "${jogador.nick}" no site. Usamos o nick do site.`,
      });
    }

    // Regra 6: valores diferentes (uma duplicata já mostrou os valores lado a lado)
    if (linhasDoNick.length === 1) itens.push(...compararValores(idPartida, linhasDoNick[0], jogador));
  }

  // Regra 7 (lado do site): jogou, segundo o site, mas não está na planilha
  for (const [chave, jogador] of doSite) {
    if (encontrados.has(chave)) continue;
    itens.push({
      tipo: 'jogador_so_no_site', idPartida, nick: jogador.nick, acao: 'ciente',
      valorPlanilha: null, valorSite: descrever(jogador.minutos, jogador.kills),
      mensagem: `${jogador.nick} (${jogador.time}) jogou a partida ${idPartida} segundo o site, mas não está na planilha. Usamos os dados do site.`,
    });
  }
  return itens;
}

function compararValores(idPartida: string, linha: LinhaPlanilha, jogador: JogadorSite): ItemPendencia[] {
  const itens: ItemPendencia[] = [];
  const divergencia = (campo: 'minutos' | 'kills' | 'time', planilha: string, site: string, mensagem: string) =>
    itens.push({
      tipo: 'divergencia', idPartida, nick: jogador.nick, campo,
      valorPlanilha: planilha, valorSite: site, acao: 'ciente', mensagem,
    });

  if (normalizarNome(linha.time) !== normalizarNome(jogador.time)) {
    divergencia('time', linha.time, jogador.time,
      `${jogador.nick} na partida ${idPartida}: a planilha põe no time ${linha.time} e o site no ${jogador.time}. Usamos o time do site.`);
  }
  if (linha.minutos !== jogador.minutos) {
    divergencia('minutos', String(linha.minutos), String(jogador.minutos),
      `${jogador.nick} na partida ${idPartida}: a planilha diz ${linha.minutos} minutos e o site diz ${jogador.minutos}. Usamos o valor do site.`);
  }
  if (linha.kills !== jogador.kills) {
    divergencia('kills', String(linha.kills), String(jogador.kills),
      `${jogador.nick} na partida ${idPartida}: a planilha diz ${linha.kills} kills e o site diz ${jogador.kills}. Usamos o valor do site.`);
  }
  return itens;
}

// ----------------------------------------------------------------- vencedor

/**
 * Vencedor segundo a planilha: o time em que todas as linhas dizem "sim", com o outro time em
 * "não" ou vazio. Tudo vazio = null. Qualquer outra combinação = "incoerente".
 */
function vencedorDaPlanilha(linhas: LinhaPlanilha[]): string | null {
  if (linhas.every((l) => l.venceu === null)) return null;
  const estados = timesNaOrdem(linhas).map((time) => {
    const valores = new Set(linhas.filter((l) => normalizarNome(l.time) === normalizarNome(time)).map((l) => l.venceu));
    return { time, estado: valores.size > 1 ? 'misto' : [...valores][0] };
  });
  const vencedores = estados.filter((e) => e.estado === true);
  if (vencedores.length === 1 && estados.every((e) => e.estado !== 'misto')) return vencedores[0].time;
  return 'incoerente';
}

/** Regra 6 (vencedor): um item da partida, não um por jogador. */
function compararVencedor(idPartida: string, linhas: LinhaPlanilha[], site: PartidaSite): ItemPendencia[] {
  const planilha = vencedorDaPlanilha(linhas);
  if (planilha !== null && normalizarNome(planilha) === normalizarNome(site.vencedor)) return [];

  const comoEsta = planilha === null
    ? 'a planilha não diz quem venceu'
    : planilha === 'incoerente'
      ? 'a planilha está incoerente sobre quem venceu'
      : `a planilha diz que ${planilha} venceu`;
  return [{
    tipo: 'divergencia', idPartida, campo: 'vencedor', valorPlanilha: planilha, valorSite: site.vencedor, acao: 'ciente',
    mensagem: `Na partida ${idPartida}, ${comoEsta} e o site diz que ${site.vencedor} venceu. Usamos o resultado do site.`,
  }];
}

// ----------------------------------------------------------------- torneio todo

function anotarGrafiasDeTime(
  grafias: Map<string, { planilha: Set<string>; site: string; partidas: string[] }>,
  timesPlanilha: string[],
  site: PartidaSite,
  idPartida: string,
) {
  for (const time of timesPlanilha) {
    const oficial = site.times.find((t) => normalizarNome(t) === normalizarNome(time))!;
    if (time === oficial) continue;
    const registro = grafias.get(oficial) ?? { planilha: new Set<string>(), site: oficial, partidas: [] };
    registro.planilha.add(time);
    registro.partidas.push(idPartida);
    grafias.set(oficial, registro);
  }
}

/** Nome de time escrito diferente do site: um aviso por time no torneio. */
function itensDeGrafiaDeTime(
  grafias: Map<string, { planilha: Set<string>; site: string; partidas: string[] }>,
): ItemPendencia[] {
  return [...grafias.values()].map(({ planilha, site, partidas }) => {
    const comoEsta = juntarComE([...planilha].map((t) => `"${t}"`));
    return {
      tipo: 'time_escrito_diferente', idPartida: null, partidas, valorPlanilha: [...planilha].join(', '), valorSite: site, acao: 'ciente',
      mensagem: `O time está escrito ${comoEsta} na planilha e "${site}" no site (partidas ${juntarComE(partidas)}). Usamos o nome do site.`,
    };
  });
}

/** Regra 8 (D13), só com os dados do site: um item por jogador no torneio todo. */
function jogadoresEmDoisTimes(partidas: PartidaSite[]): ItemPendencia[] {
  const porNick = new Map<string, { times: string[]; partidas: string[] }>();
  for (const partida of partidas) {
    for (const { nick, time } of partida.jogadores) {
      const registro = porNick.get(nick) ?? { times: [], partidas: [] };
      if (!registro.times.includes(time)) registro.times.push(time);
      registro.partidas.push(partida.id);
      porNick.set(nick, registro);
    }
  }
  return [...porNick].filter(([, r]) => r.times.length > 1).map(([nick, { times, partidas: ids }]) => ({
    tipo: 'jogador_dois_times', idPartida: null, partidas: ids, nick,
    valorPlanilha: null, valorSite: juntarComE(times), acao: 'ciente',
    mensagem: `${nick} jogou por ${juntarComE(times)}, segundo o site. Recebe pelos minutos em cada time em que jogou.`,
  }));
}
