import type { JogadorDoResultado, TimeDaClassificacao } from '../servicos/api';
import { formatarCentavos } from './dinheiro';

export const juntarComE = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`);
const ordinal = (n: number) => `${n}º`;

const posicoesPremiadas = (percentuais: number[]) => percentuais.map((p, i) => ({ posicao: i + 1, percentual: p })).filter((p) => p.percentual > 0);
const contarPosicoes = (n: number) => `${n} ${n === 1 ? 'posição' : 'posições'}`;

export function descreverPosicoesPremiadas(percentuais: number[]): string {
  const premiadas = posicoesPremiadas(percentuais);
  return `Premia ${contarPosicoes(premiadas.length)}: ${premiadas.map((p) => `${ordinal(p.posicao)} ${p.percentual}%`).join(' · ')}`;
}

function fracao(n: number): string {
  if (n === 2) return 'metade';
  if (n === 3) return 'um terço';
  if (n === 4) return 'um quarto';
  return `1/${n}`;
}

export function explicarEmpates(times: TimeDaClassificacao[], percentuais: number[]): string[] {
  const porVitorias = new Map<number, TimeDaClassificacao[]>();
  for (const t of times) porVitorias.set(t.vitorias, [...(porVitorias.get(t.vitorias) ?? []), t]);

  const frases: string[] = [];
  for (const [vitorias, grupo] of porVitorias) {
    if (grupo.length < 2) continue;
    const abertura = `${juntarComE(grupo.map((t) => t.time))} terminaram com ${vitorias} ${vitorias === 1 ? 'vitória' : 'vitórias'}`;

    const porKills = new Map<number, TimeDaClassificacao[]>();
    for (const t of grupo) porKills.set(t.killsTime, [...(porKills.get(t.killsTime) ?? []), t]);
    const subgrupos = [...porKills.values()];

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

function empateTotal(times: TimeDaClassificacao[], percentuais: number[], depoisDaAbertura: boolean): string {
  const kills = times[0].killsTime;
  const posicao = times[0].posicao;
  const total = times.reduce((soma, t) => soma + t.premioCentavos, 0);
  const inicio = depoisDaAbertura ? `empataram também em kills (${kills}) e` : `empataram também em kills (${kills}):`;
  if (total === 0) return `${inicio} ficaram em ${ordinal(posicao)}. Este torneio premia só ${contarPosicoes(posicoesPremiadas(percentuais).length)}.`;

  const pagas = Array.from({ length: times.length }, (_, i) => posicao + i).filter((p) => (percentuais[p - 1] ?? 0) > 0);
  const posicoes = pagas.length === 1
    ? `o prêmio do ${ordinal(pagas[0])} lugar`
    : `os prêmios ${juntarComE(pagas.map((p) => `do ${ordinal(p)}`))} lugar`;
  const valor = formatarCentavos(total);
  const cada = `${fracao(times.length)} para cada time.`;
  return depoisDaAbertura ? `${inicio} dividiram ${posicoes}: ${valor}, ${cada}` : `${inicio} dividiram ${posicoes}, ${valor}, ${cada}`;
}

export function rotuloDoCriterio(criterio: string | null): { texto: string; tom: 'info' | 'alerta' | 'neutro' } | null {
  if (criterio === 'desempate por kills do time') return { texto: 'Desempate por kills', tom: 'info' };
  if (criterio === 'divisão igual (empate em vitórias e kills)') return { texto: 'Empate total · prêmio dividido', tom: 'alerta' };
  if (criterio === 'empate em vitórias e kills') return { texto: 'Empate total', tom: 'neutro' };
  return criterio ? { texto: criterio, tom: 'neutro' } : null;
}

export function percentualDoTime(base: number, baseTime: number): string {
  if (baseTime === 0) return '—';
  const centesimos = Math.floor((base * 20_000 + baseTime) / (2 * baseTime));
  return `${Math.floor(centesimos / 100)},${String(centesimos % 100).padStart(2, '0')}%`;
}

export function observacaoDoJogador(j: JogadorDoResultado): string {
  return [j.recebeuCentavo ? '+R$ 0,01 de arredondamento' : '', j.explicacao ?? ''].filter(Boolean).join(' · ');
}

export const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim();

export interface BuscaNoResultado {
  premiados: JogadorDoResultado[];
  semPremio: string[];
  nenhum: boolean;
}

export function buscarNoResultado(jogadores: JogadorDoResultado[], busca: string): BuscaNoResultado {
  const procurado = normalizar(busca);
  const batem = procurado ? jogadores.filter((j) => normalizar(j.nick).includes(procurado)) : jogadores;
  const premiados = batem.filter((j) => j.premioCentavos > 0);
  const semPremio = procurado
    ? batem.filter((j) => j.premioCentavos === 0).map((j) => `${j.nick} jogou pelo time ${j.time}, que ficou em ${ordinal(j.posicao)}, sem prêmio.`)
    : [];
  return { premiados, semPremio, nenhum: procurado !== '' && batem.length === 0 };
}
