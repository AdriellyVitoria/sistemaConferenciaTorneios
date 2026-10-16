import { nomeDoArquivoBaixado } from '../utilitarios/arquivo';
import { guardarSenha, senhaGuardada, senhaRecusada } from './sessao';

export interface Saude {
  api: 'ok';
  banco: 'ok' | 'erro';
}

export type ModoDivisao = 'minutos' | 'kills';
export type StatusTorneio = 'criado' | 'importado' | 'conferindo' | 'pronto' | 'calculado';
export type StatusConferencia = 'aguardando' | 'em_consulta' | 'conferida' | 'nao_encontrada' | 'times_diferentes';
export type OrigemDoErro = 'site' | 'interno';

export interface NovoTorneio {
  nome: string;
  premioCentavos: number;
  percentuais: number[];
  modoDivisao: ModoDivisao;
}

export interface Torneio extends NovoTorneio {
  id: number;
  status: StatusTorneio;
  calculadoEm: string | null;
  planilhaArquivo: string | null;
  planilhaImportadaEm: string | null;
  planilhaConvertidaDeWindows1252: boolean;
  criadoEm: string;
}

export interface ResumoTorneio extends Torneio {
  quantidadeDePartidas: number;
  primeiraPartidaEm: string | null;
}

export interface Partida {
  id: number;
  idPartida: string;
  idPartidaPlanilha: string;
  rodada: number;
  data: string;
  timeA: string;
  timeB: string;
  vencedor: string | null;
  statusConferencia: StatusConferencia;
  tentativas: number;
  proximaTentativaEm: string | null;
  ultimaTentativaEm: string | null;
  emConsultaDesde: string | null;
  ultimoErro: string | null;
  origemDoErro: OrigemDoErro | null;
  killsSite: { timeA: number; timeB: number } | null;
}

export interface SituacaoDoCalculo {
  podeCalcular: boolean;
  calculado: boolean;
  calculadoEm: string | null;
  semPlanilha: boolean;
  aguardandoSite: number;
  bloqueios: number;
  semCiente: number;
}

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

export interface Pendencia {
  chave: string;
  tipo: TipoPendencia;
  idPartida: string | null;
  partidas?: string[];
  nick?: string;
  campo?: 'vencedor' | 'minutos' | 'kills' | 'time';
  valorPlanilha: string | null;
  valorSite: string | null;
  mensagem: string;
  bloqueante: boolean;
  ciente: boolean;
  cienteEm: string | null;
}

export interface ListaDePendencias {
  bloqueantes: Pendencia[];
  naoBloqueantes: Pendencia[];
  resumo: { bloqueantes: number; naoBloqueantes: number; comCiente: number; semCiente: number; aguardandoSite: number };
}

export interface TorneioComPartidas extends Torneio {
  partidas: Partida[];
  calculo: SituacaoDoCalculo;
  segundosParaTentarAgora: number;
}

export interface ErroCampo {
  campo: string;
  mensagem: string;
}

export interface ErroPlanilha {
  linha?: number;
  linhas?: number[];
  coluna?: string;
  valor?: string;
  mensagem: string;
}

export interface PlanilhaImportada {
  linhas: number;
  partidas: number;
  convertidoDeWindows1252: boolean;
  substituiuPlanilhaAnterior: boolean;
}

export type ResultadoEnvio =
  | { tipo: 'importada'; resultado: PlanilhaImportada }
  | { tipo: 'recusada'; erros: ErroPlanilha[]; convertidoDeWindows1252: boolean }
  | { tipo: 'erro'; mensagem: string };

export class ErroDaApi extends Error {}

export async function buscarSaude(): Promise<Saude> {
  const resposta = await fetch('/api/saude');
  if (!resposta.ok && resposta.status !== 503) {
    throw new Error(`API respondeu ${resposta.status}`);
  }
  return resposta.json();
}

export async function listarTorneios(): Promise<ResumoTorneio[]> {
  return lerOuFalhar(await chamar('/api/torneios'));
}

export async function buscarTorneio(id: number): Promise<TorneioComPartidas> {
  return lerOuFalhar(await chamar(`/api/torneios/${id}`));
}

export async function criarTorneio(
  novo: NovoTorneio,
): Promise<{ ok: true; id: number } | { ok: false; erros: ErroCampo[] }> {
  const resposta = await chamar('/api/torneios', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(novo),
  });
  if (resposta.status === 400) {
    const corpo = await resposta.json();
    return { ok: false, erros: corpo.erros ?? [{ campo: '', mensagem: corpo.erro }] };
  }
  const { id } = await lerOuFalhar<{ id: number }>(resposta);
  return { ok: true, id };
}

export async function enviarPlanilha(torneioId: number, arquivo: File): Promise<ResultadoEnvio> {
  const resposta = await chamar(`/api/torneios/${torneioId}/planilha`, {
    method: 'PUT',
    headers: { 'content-type': 'text/csv', 'x-nome-arquivo': encodeURIComponent(arquivo.name) },
    body: arquivo,
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.ok) return { tipo: 'importada', resultado: corpo };
  if (resposta.status === 400 && Array.isArray(corpo.erros)) {
    return { tipo: 'recusada', erros: corpo.erros, convertidoDeWindows1252: Boolean(corpo.convertidoDeWindows1252) };
  }
  return { tipo: 'erro', mensagem: corpo.erro ?? `Não foi possível enviar a planilha (erro ${resposta.status}).` };
}

export type ResultadoTentarAgora =
  | { tipo: 'antecipadas'; antecipadas: number; segundosParaTentarAgora: number }
  | { tipo: 'aguarde'; segundosParaTentarAgora: number; mensagem: string }
  | { tipo: 'erro'; mensagem: string };

export async function tentarAgora(torneioId: number): Promise<ResultadoTentarAgora> {
  const resposta = await chamar(`/api/torneios/${torneioId}/tentar-agora`, { method: 'POST' });
  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.ok) return { tipo: 'antecipadas', antecipadas: corpo.antecipadas, segundosParaTentarAgora: corpo.segundosParaTentarAgora };
  if (resposta.status === 429) return { tipo: 'aguarde', segundosParaTentarAgora: corpo.segundosParaTentarAgora, mensagem: corpo.erro };
  return { tipo: 'erro', mensagem: corpo.erro ?? `Não foi possível tentar agora (erro ${resposta.status}).` };
}

export async function listarPendencias(torneioId: number): Promise<ListaDePendencias> {
  return lerOuFalhar(await chamar(`/api/torneios/${torneioId}/pendencias`));
}

export type ResultadoCiente = { tipo: 'ok' } | { tipo: 'mudou' } | { tipo: 'erro'; mensagem: string };

export async function definirCiente(torneioId: number, chave: string, ciente: boolean): Promise<ResultadoCiente> {
  const resposta = await chamar(`/api/torneios/${torneioId}/pendencias/${chave}/ciente`, { method: ciente ? 'PUT' : 'DELETE' });
  if (resposta.ok) return { tipo: 'ok' };
  if (resposta.status === 404) return { tipo: 'mudou' };
  const corpo = await resposta.json().catch(() => ({}));
  return { tipo: 'erro', mensagem: corpo.erro ?? `Não foi possível registrar o Ciente (erro ${resposta.status}).` };
}

export async function cienteDeTodas(torneioId: number): Promise<{ tipo: 'ok'; marcadas: number } | { tipo: 'erro'; mensagem: string }> {
  const resposta = await chamar(`/api/torneios/${torneioId}/pendencias/ciente-de-todas`, { method: 'POST' });
  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.ok) return { tipo: 'ok', marcadas: corpo.marcadas };
  return { tipo: 'erro', mensagem: corpo.erro ?? `Não foi possível marcar o Ciente (erro ${resposta.status}).` };
}

export async function corrigirIdPartida(
  torneioId: number,
  partidaId: number,
  idPartida: string,
): Promise<{ tipo: 'ok'; partida: Partida } | { tipo: 'erro'; mensagem: string }> {
  const resposta = await chamar(`/api/torneios/${torneioId}/partidas/${partidaId}/id-partida`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idPartida }),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.ok) return { tipo: 'ok', partida: corpo };
  return { tipo: 'erro', mensagem: corpo.erro ?? `Não foi possível corrigir o ID (erro ${resposta.status}).` };
}

export interface TimeDaClassificacao {
  posicao: number;
  time: string;
  vitorias: number;
  killsTime: number;
  premioCentavos: number;
  criterio: string | null;
}

export interface TimeDoResultado extends TimeDaClassificacao {
  recebeuCentavo: boolean;
}

export interface JogadorDoResultado {
  time: string;
  posicao: number;
  nick: string;
  minutos: number;
  kills: number;
  base: number;
  baseTime: number;
  baseUsada: ModoDivisao;
  premioCentavos: number;
  recebeuCentavo: boolean;
  explicacao: string | null;
}

export interface ResultadoDoTorneio {
  torneio: { id: number; nome: string };
  calculadoEm: string;
  premioCentavos: number;
  percentuais: number[];
  modoDivisao: ModoDivisao;
  times: TimeDoResultado[];
  jogadores: JogadorDoResultado[];
}

export async function buscarResultado(torneioId: number): Promise<{ tipo: 'ok'; resultado: ResultadoDoTorneio } | { tipo: 'nao_calculado' | 'erro'; mensagem: string }> {
  const resposta = await chamar(`/api/torneios/${torneioId}/resultado`);
  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.ok) return { tipo: 'ok', resultado: corpo };
  return {
    tipo: resposta.status === 409 ? 'nao_calculado' : 'erro',
    mensagem: corpo.erro ?? `Não foi possível ler o resultado (erro ${resposta.status}).`,
  };
}

export async function baixarCsvDoResultado(torneioId: number): Promise<{ tipo: 'ok'; arquivo: Blob; nome: string } | { tipo: 'erro'; mensagem: string }> {
  let resposta: Response;
  try {
    resposta = await chamar(`/api/torneios/${torneioId}/resultado.csv`);
  } catch (e) {
    return { tipo: 'erro', mensagem: (e as Error).message };
  }
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    return { tipo: 'erro', mensagem: corpo.erro ?? `O servidor respondeu com erro ${resposta.status}.` };
  }
  return { tipo: 'ok', arquivo: await resposta.blob(), nome: nomeDoArquivoBaixado(resposta.headers.get('content-disposition'), 'resultado.csv') };
}

export interface PaginaPublica {
  torneio: { nome: string };
  calculadoEm: string;
  regras: {
    premioCentavos: number;
    percentuais: number[];
    modoDivisao: ModoDivisao;
    criterioDeDesempate: string;
  };
  classificacao: TimeDaClassificacao[];
}

export type LeituraPorLink<T> = { tipo: 'ok'; pagina: T } | { tipo: 'nao_encontrada' } | { tipo: 'erro' };

async function lerPorLink<T>(caminho: string): Promise<LeituraPorLink<T>> {
  let resposta: Response;
  try {
    resposta = await fetch(caminho);
  } catch {
    return { tipo: 'erro' };
  }
  if (resposta.status === 404) return { tipo: 'nao_encontrada' };
  if (!resposta.ok) return { tipo: 'erro' };
  try {
    return { tipo: 'ok', pagina: await resposta.json() };
  } catch {
    return { tipo: 'erro' };
  }
}

export const buscarPaginaPublica = (codigo: string) => lerPorLink<PaginaPublica>(`/api/publico/${encodeURIComponent(codigo)}`);

export interface JogadorDaPaginaDoTime {
  nick: string;
  base: number;
  baseUsada: ModoDivisao;
  centesimosDePercentual: number;
  premioCentavos: number;
  recebeuCentavo: boolean;
  explicacao: string | null;
}

export interface PaginaDoTime {
  torneio: { nome: string };
  calculadoEm: string;
  time: { nome: string; posicao: number; premioCentavos: number; baseUsada: ModoDivisao; baseTime: number };
  comoFoiCalculado: {
    premioTotalCentavos: number;
    percentualDaPosicao: number;
    criterio: string | null;
    empate: { posicoes: number[]; percentuais: number[]; quantidadeDeTimes: number } | null;
    modoDivisao: ModoDivisao;
  };
  jogadores: JogadorDaPaginaDoTime[];
  totalCentavos: number;
  codigoPublico: string;
}

export const buscarPaginaDoTime = (codigo: string) => lerPorLink<PaginaDoTime>(`/api/time/${encodeURIComponent(codigo)}`);

export interface LinksDoTorneio {
  publico: { codigo: string };
  times: { time: string; posicao: number; premioCentavos: number; codigo: string }[];
}

export async function buscarLinks(torneioId: number): Promise<LinksDoTorneio> {
  return lerOuFalhar(await chamar(`/api/torneios/${torneioId}/links`));
}

export async function calcularPremios(torneioId: number): Promise<{ tipo: 'ok' } | { tipo: 'recusado'; mensagem: string } | { tipo: 'erro'; mensagem: string }> {
  const resposta = await chamar(`/api/torneios/${torneioId}/calculo`, { method: 'POST' });
  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.ok) return { tipo: 'ok' };
  if (resposta.status === 409) return { tipo: 'recusado', mensagem: corpo.erro ?? 'Algo mudou: confira a página antes de calcular.' };
  return { tipo: 'erro', mensagem: corpo.erro ?? `Não foi possível calcular (erro ${resposta.status}).` };
}

export async function removerTorneio(torneioId: number): Promise<{ tipo: 'removido' } | { tipo: 'recusado' | 'erro'; mensagem: string }> {
  let resposta: Response;
  try {
    resposta = await chamar(`/api/torneios/${torneioId}`, { method: 'DELETE' });
  } catch (e) {
    return { tipo: 'erro', mensagem: (e as Error).message };
  }
  if (resposta.status === 204 || resposta.status === 404) return { tipo: 'removido' };
  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.status === 409) return { tipo: 'recusado', mensagem: corpo.erro ?? 'Este torneio não pode mais ser removido.' };
  return { tipo: 'erro', mensagem: corpo.erro ?? `Não foi possível remover o torneio (erro ${resposta.status}).` };
}

const SEM_SERVIDOR = 'Não foi possível falar com o servidor. Confira se o sistema está no ar e tente de novo.';

async function chamar(caminho: string, opcoes: RequestInit = {}): Promise<Response> {
  const cabecalhos = new Headers(opcoes.headers);
  const senha = senhaGuardada();
  if (senha !== null) cabecalhos.set('authorization', `Bearer ${senha}`);
  let resposta: Response;
  try {
    resposta = await fetch(caminho, { ...opcoes, headers: cabecalhos });
  } catch {
    throw new ErroDaApi(SEM_SERVIDOR);
  }
  if (resposta.status === 401) {
    senhaRecusada();
    throw new ErroDaApi('Acesso só da organizadora.');
  }
  return resposta;
}

export async function entrar(senha: string): Promise<{ tipo: 'ok' } | { tipo: 'incorreta' } | { tipo: 'erro'; mensagem: string }> {
  if (!/^[\x20-\x7e]+$/.test(senha)) return { tipo: 'incorreta' };
  let resposta: Response;
  try {
    resposta = await fetch('/api/acesso', { headers: { authorization: `Bearer ${senha}` } });
  } catch {
    return { tipo: 'erro', mensagem: SEM_SERVIDOR };
  }
  if (resposta.status === 401) return { tipo: 'incorreta' };
  if (!resposta.ok) return { tipo: 'erro', mensagem: `O servidor respondeu com erro ${resposta.status}. Tente de novo.` };
  guardarSenha(senha);
  return { tipo: 'ok' };
}

async function lerOuFalhar<T>(resposta: Response): Promise<T> {
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new ErroDaApi(corpo?.erro ?? `O servidor respondeu com erro ${resposta.status}.`);
  return corpo as T;
}
