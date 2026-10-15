/**
 * Regras da tela do resultado (6e), sem Vue nem HTTP. Tudo sai do que foi gravado no cálculo:
 * nada aqui é fixo para setembro, e nada de dinheiro é recalculado (só somado, em centavos).
 */

import type { JogadorDoResultado, TimeDoResultado } from '../servicos/api';
import { formatarCentavos } from './dinheiro';

const juntarComE = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`);
const ordinal = (n: number) => `${n}º`;

/** A fração de cada time num empate total: "metade", "um terço"... */
function fracao(n: number): string {
  if (n === 2) return 'metade';
  if (n === 3) return 'um terço';
  if (n === 4) return 'um quarto';
  return `1/${n}`;
}

/**
 * As frases que explicam os empates da classificação (D2), uma por grupo de times com as mesmas
 * vitórias. Ex.: "Corvos, Falcões e Tubarões terminaram com 3 vitórias. Corvos fez mais kills
 * (368) e ficou em 2º. Falcões e Tubarões empataram também em kills (310) e dividiram o prêmio do
 * 3º lugar: R$ 2.000,00, metade para cada time." Os percentuais dizem quais posições pagavam.
 */
export function explicarEmpates(times: TimeDoResultado[], percentuais: number[]): string[] {
  const porVitorias = new Map<number, TimeDoResultado[]>();
  for (const t of times) porVitorias.set(t.vitorias, [...(porVitorias.get(t.vitorias) ?? []), t]);

  const frases: string[] = [];
  for (const [vitorias, grupo] of porVitorias) {
    if (grupo.length < 2) continue;
    const abertura = `${juntarComE(grupo.map((t) => t.time))} terminaram com ${vitorias} ${vitorias === 1 ? 'vitória' : 'vitórias'}`;

    // dentro do grupo, os times com as mesmas kills (empate total) e os desempatados
    const porKills = new Map<number, TimeDoResultado[]>();
    for (const t of grupo) porKills.set(t.killsTime, [...(porKills.get(t.killsTime) ?? []), t]);
    const subgrupos = [...porKills.values()];

    // o grupo inteiro empatado também em kills: uma frase só
    if (subgrupos.length === 1) {
      frases.push(`${abertura} e ${empateTotal(grupo, percentuais, false)}`);
      continue;
    }

    const partes = [`${abertura}.`];
    subgrupos.forEach((sub, i) => {
      if (sub.length > 1) {
        partes.push(`${juntarComE(sub.map((t) => t.time))} ${empateTotal(sub, percentuais, true)}`);
      } else if (i === 0) {
        partes.push(`${sub[0].time} fez mais kills (${sub[0].killsTime}) e ficou em ${ordinal(sub[0].posicao)}.`);
      } else {
        partes.push(`${sub[0].time} ficou em ${ordinal(sub[0].posicao)} (${sub[0].killsTime} kills).`);
      }
    });
    frases.push(partes.join(' '));
  }
  return frases;
}

/** "empataram também em kills (310) e dividiram o prêmio do 3º lugar: R$ 2.000,00, metade para cada time." */
function empateTotal(times: TimeDoResultado[], percentuais: number[], depoisDaAbertura: boolean): string {
  const kills = times[0].killsTime;
  const posicao = times[0].posicao;
  const total = times.reduce((soma, t) => soma + t.premioCentavos, 0);
  const inicio = depoisDaAbertura ? `empataram também em kills (${kills}) e` : `empataram também em kills (${kills}):`;
  if (total === 0) return `${inicio} ficaram em ${ordinal(posicao)}, sem prêmio.`;

  // as posições que o grupo ocupa e que pagavam algo
  const pagas = Array.from({ length: times.length }, (_, i) => posicao + i).filter((p) => (percentuais[p - 1] ?? 0) > 0);
  const posicoes = pagas.length === 1
    ? `o prêmio do ${ordinal(pagas[0])} lugar`
    : `os prêmios ${juntarComE(pagas.map((p) => `do ${ordinal(p)}`))} lugar`;
  const valor = formatarCentavos(total);
  const cada = `${fracao(times.length)} para cada time.`;
  return depoisDaAbertura ? `${inicio} dividiram ${posicoes}: ${valor}, ${cada}` : `${inicio} dividiram ${posicoes}, ${valor}, ${cada}`;
}

/** O critério gravado, como selo curto na tabela. */
export function rotuloDoCriterio(criterio: string | null): { texto: string; tom: 'info' | 'alerta' | 'neutro' } | null {
  if (criterio === 'desempate por kills do time') return { texto: 'Desempate por kills', tom: 'info' };
  if (criterio === 'divisão igual (empate em vitórias e kills)') return { texto: 'Empate total · prêmio dividido', tom: 'alerta' };
  if (criterio === 'empate em vitórias e kills') return { texto: 'Empate total', tom: 'neutro' };
  return criterio ? { texto: criterio, tom: 'neutro' } : null;
}

/** "2,20%": a parte do jogador no time, com duas casas, arredondada só com inteiros. */
export function percentualDoTime(base: number, baseTime: number): string {
  if (baseTime === 0) return '—';
  // centésimos de ponto percentual, arredondados para o mais próximo: (base * 10000 / baseTime)
  const centesimos = Math.floor((base * 20_000 + baseTime) / (2 * baseTime));
  return `${Math.floor(centesimos / 100)},${String(centesimos % 100).padStart(2, '0')}%`;
}

/** A observação da linha: o centavo de arredondamento (D9) e a explicação gravada (D21). */
export function observacaoDoJogador(j: JogadorDoResultado): string {
  return [j.recebeuCentavo ? '+R$ 0,01 de arredondamento' : '', j.explicacao ?? ''].filter(Boolean).join(' · ');
}

const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim();

export interface BuscaNoResultado {
  /** Os jogadores premiados que batem com a busca (todos, sem busca). */
  premiados: JogadorDoResultado[];
  /** Uma frase por jogador de time sem prêmio que bate com a busca. */
  semPremio: string[];
  /** A busca não achou ninguém, premiado ou não. */
  nenhum: boolean;
}

/**
 * O filtro por nick: parcial, sem diferenciar maiúsculas e acentos ("sniper" acha xXSniperXx,
 * "vibora" acha Víbora). Sem busca, só os premiados. Jogador de time sem prêmio vira uma frase:
 * "Víbora jogou pelo time Serpentes, que ficou em 6º, sem prêmio."
 */
export function buscarNoResultado(jogadores: JogadorDoResultado[], busca: string): BuscaNoResultado {
  const procurado = normalizar(busca);
  const batem = procurado ? jogadores.filter((j) => normalizar(j.nick).includes(procurado)) : jogadores;
  const premiados = batem.filter((j) => j.premioCentavos > 0);
  const semPremio = procurado
    ? batem.filter((j) => j.premioCentavos === 0).map((j) => `${j.nick} jogou pelo time ${j.time}, que ficou em ${ordinal(j.posicao)}, sem prêmio.`)
    : [];
  return { premiados, semPremio, nenhum: procurado !== '' && batem.length === 0 };
}
