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
  idPartida: string | null;
  partidas?: string[];
  nick?: string;
  campo?: 'vencedor' | 'minutos' | 'kills' | 'time';
  valorPlanilha: string | null;
  valorSite: string | null;
  acao: 'ciente' | 'corrigir_id';
  mensagem: string;
}

export interface ResultadoComparacao {
  pendencias: ItemPendencia[];
  partidasOficiais: PartidaSite[];
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

    if (resposta.status === 'nao_encontrada') {
      pendencias.push({
        tipo: 'nao_encontrada', idPartida, valorPlanilha: idPartida, valorSite: null, acao: 'corrigir_id',
        mensagem: `O site não encontrou a partida ${idPartida}. Confira o ID na planilha e corrija.`,
      });
      continue;
    }

    const site = resposta.partida;
    const timesPlanilha = timesNaOrdem(linhasDaPartida);

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

function agruparPorPartida(linhas: LinhaPlanilha[]): Map<string, LinhaPlanilha[]> {
  const grupos = new Map<string, LinhaPlanilha[]>();
  for (const l of linhas) grupos.set(l.idPartida, [...(grupos.get(l.idPartida) ?? []), l]);
  return grupos;
}

function timesNaOrdem(linhas: LinhaPlanilha[]): string[] {
  const vistos = new Map<string, string>();
  for (const l of linhas) if (!vistos.has(normalizarNome(l.time))) vistos.set(normalizarNome(l.time), l.time);
  return [...vistos.values()];
}

function mesmosTimes(planilha: string[], site: string[]): boolean {
  const a = planilha.map(normalizarNome).sort();
  const b = site.map(normalizarNome).sort();
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

const descrever = (minutos: number, kills: number) => `${minutos} min, ${kills} kills`;

function compararJogadores(idPartida: string, linhas: LinhaPlanilha[], site: PartidaSite): ItemPendencia[] {
  const itens: ItemPendencia[] = [];
  const doSite = new Map(site.jogadores.map((j) => [normalizarNome(j.nick), j]));
  const encontrados = new Set<string>();

  const porNick = new Map<string, LinhaPlanilha[]>();
  for (const l of linhas) porNick.set(normalizarNome(l.nick), [...(porNick.get(normalizarNome(l.nick)) ?? []), l]);

  for (const [chave, linhasDoNick] of porNick) {
    const jogador = doSite.get(chave);
    const nick = jogador?.nick ?? linhasDoNick[0].nick;
    if (jogador) encontrados.add(chave);

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

    if (!jogador) {
      const l = linhasDoNick[0];
      itens.push({
        tipo: 'jogador_so_na_planilha', idPartida, nick, acao: 'ciente',
        valorPlanilha: descrever(l.minutos, l.kills), valorSite: null,
        mensagem: `${nick} está na planilha na partida ${idPartida}, mas o site não registra esse jogador. Ele não entra no cálculo dessa partida.`,
      });
      continue;
    }

    const grafia = linhasDoNick.find((l) => l.nick !== jogador.nick);
    if (grafia) {
      itens.push({
        tipo: 'nick_diferente', idPartida, nick, valorPlanilha: grafia.nick, valorSite: jogador.nick, acao: 'ciente',
        mensagem: `Na partida ${idPartida}, o nick está escrito "${grafia.nick}" na planilha e "${jogador.nick}" no site. Usamos o nick do site.`,
      });
    }

    if (linhasDoNick.length === 1) itens.push(...compararValores(idPartida, linhasDoNick[0], jogador));
  }

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
