import type { ModoDivisao, ResumoTorneio, StatusTorneio } from '../servicos/api';
import { formatarCentavos } from './dinheiro';

export type Filtro = 'todos' | 'andamento' | 'calculados';
export type FiltroDeMes = string;
export type FiltroDeDivisao = 'todas' | ModoDivisao;

export interface Filtros {
  situacao: Filtro;
  busca: string;
  mes: FiltroDeMes;
  divisao: FiltroDeDivisao;
}

const emAndamento = (t: ResumoTorneio) => t.status !== 'calculado';
const calculado = (t: ResumoTorneio) => t.status === 'calculado';

const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim();

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function mesDoInstante(iso: string, fuso?: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', { year: 'numeric', month: '2-digit', timeZone: fuso }).formatToParts(new Date(iso));
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${parte('year')}-${parte('month')}`;
}

export function mesDoTorneio(t: ResumoTorneio, fuso?: string): string {
  return t.primeiraPartidaEm ? t.primeiraPartidaEm.slice(0, 7) : mesDoInstante(t.criadoEm, fuso);
}

export const mesDeHoje = (fuso?: string) => mesDoInstante(new Date().toISOString(), fuso);

export function rotuloDoMes(mes: string): string {
  const [ano, numero] = mes.split('-');
  const nome = MESES[Number(numero) - 1];
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

export function filtrarTorneios(lista: ResumoTorneio[], filtros: Filtros, fuso?: string): ResumoTorneio[] {
  const procurado = normalizar(filtros.busca);
  return lista.filter((t) => {
    if (filtros.situacao === 'andamento' && !emAndamento(t)) return false;
    if (filtros.situacao === 'calculados' && !calculado(t)) return false;
    if (filtros.mes !== 'todos' && mesDoTorneio(t, fuso) !== filtros.mes) return false;
    if (filtros.divisao !== 'todas' && t.modoDivisao !== filtros.divisao) return false;
    return !procurado || normalizar(t.nome).includes(procurado);
  });
}

export function contarPorFiltro(lista: ResumoTorneio[]): Record<Filtro, number> {
  return { todos: lista.length, andamento: lista.filter(emAndamento).length, calculados: lista.filter(calculado).length };
}

export interface GrupoDoMes {
  mes: string;
  rotulo: string;
  torneios: ResumoTorneio[];
  resumo: string;
  aberto: boolean;
}

export function agruparPorMes(
  lista: ResumoTorneio[],
  mesAtual: string,
  { fuso, abrirTodos = false }: { fuso?: string; abrirTodos?: boolean } = {},
): { emAndamento: ResumoTorneio[]; meses: GrupoDoMes[] } {
  const porMes = new Map<string, ResumoTorneio[]>();
  for (const t of lista.filter(calculado)) {
    const mes = mesDoTorneio(t, fuso);
    porMes.set(mes, [...(porMes.get(mes) ?? []), t]);
  }
  const meses = [...porMes.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([mes, torneios]) => {
      const total = torneios.reduce((soma, t) => soma + t.premioCentavos, 0);
      return {
        mes,
        rotulo: rotuloDoMes(mes),
        torneios,
        resumo: `${torneios.length} ${torneios.length === 1 ? 'torneio' : 'torneios'} · ${formatarCentavos(total)}`,
        aberto: abrirTodos || mes === mesAtual,
      };
    });
  return { emAndamento: lista.filter(emAndamento), meses };
}

export function mesesDisponiveis(lista: ResumoTorneio[], fuso?: string): string[] {
  return [...new Set(lista.map((t) => mesDoTorneio(t, fuso)))].sort((a, b) => (a < b ? 1 : -1));
}

export function premiosCalculados(lista: ResumoTorneio[], mes: FiltroDeMes = 'todos', fuso?: string): number {
  return lista
    .filter(calculado)
    .filter((t) => mes === 'todos' || mesDoTorneio(t, fuso) === mes)
    .reduce((total, t) => total + t.premioCentavos, 0);
}

export function rotuloDosPremios(mes: FiltroDeMes, mesAtual: string): string {
  if (mes === 'todos') return 'Prêmios calculados';
  const [ano, numero] = mes.split('-');
  const nome = MESES[Number(numero) - 1];
  return ano === mesAtual.slice(0, 4) ? `Prêmios calculados em ${nome}` : `Prêmios calculados em ${nome} de ${ano}`;
}

export function acaoDoTorneio(status: StatusTorneio): string {
  if (status === 'criado') return 'Subir planilha';
  if (status === 'calculado') return 'Abrir';
  return 'Acompanhar';
}

export function descreverPartidas(t: Pick<ResumoTorneio, 'planilhaArquivo' | 'quantidadeDePartidas'>): string {
  if (t.planilhaArquivo === null) return 'Sem planilha';
  return t.quantidadeDePartidas === 1 ? '1 partida' : `${t.quantidadeDePartidas} partidas`;
}
