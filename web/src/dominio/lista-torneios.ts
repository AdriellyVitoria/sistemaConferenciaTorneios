/** Regras da lista de torneios (página inicial), sem Vue nem HTTP. Só com o que a API já devolve. */

import type { ResumoTorneio, StatusTorneio } from '../servicos/api';

export type Filtro = 'todos' | 'andamento' | 'calculados';

const emAndamento = (t: ResumoTorneio) => t.status !== 'calculado';
const calculado = (t: ResumoTorneio) => t.status === 'calculado';

/** Para buscar sem diferenciar maiúsculas e acentos: "PRIMAVÉRA" acha "Copa de Primavera". */
const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim();

export function filtrarTorneios(lista: ResumoTorneio[], filtro: Filtro, busca: string): ResumoTorneio[] {
  const escolhidos = filtro === 'andamento' ? lista.filter(emAndamento) : filtro === 'calculados' ? lista.filter(calculado) : lista;
  const procurado = normalizar(busca);
  return procurado ? escolhidos.filter((t) => normalizar(t.nome).includes(procurado)) : escolhidos;
}

export function contarPorFiltro(lista: ResumoTorneio[]): Record<Filtro, number> {
  return { todos: lista.length, andamento: lista.filter(emAndamento).length, calculados: lista.filter(calculado).length };
}

/** Soma em centavos inteiros do prêmio dos torneios já calculados. */
export const premiosCalculados = (lista: ResumoTorneio[]) => lista.filter(calculado).reduce((total, t) => total + t.premioCentavos, 0);

/** O botão de cada cartão: o próximo passo da Maria naquele torneio. */
export function acaoDoTorneio(status: StatusTorneio): string {
  if (status === 'criado') return 'Subir planilha';
  if (status === 'calculado') return 'Abrir';
  return 'Acompanhar';
}

export function descreverPartidas(t: Pick<ResumoTorneio, 'planilhaArquivo' | 'quantidadeDePartidas'>): string {
  if (t.planilhaArquivo === null) return 'Sem planilha';
  return t.quantidadeDePartidas === 1 ? '1 partida' : `${t.quantidadeDePartidas} partidas`;
}
