// Chamadas à API. Todas passam pelo prefixo /api, que o Vite repassa para o servidor.

export interface Saude {
  api: 'ok';
  banco: 'ok' | 'erro';
}

export type ModoDivisao = 'minutos' | 'kills';
export type StatusTorneio = 'criado' | 'importado' | 'conferindo' | 'pronto' | 'calculado';
export type StatusConferencia = 'aguardando' | 'em_consulta' | 'conferida' | 'nao_encontrada' | 'times_diferentes';
/** De quem foi a última falha: do site, ou nossa ("erro interno, não é o site"). */
export type OrigemDoErro = 'site' | 'interno';

export interface NovoTorneio {
  nome: string;
  /** Sempre em centavos inteiros: R$ 10.000,00 = 1000000. */
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
}

export interface Partida {
  id: number;
  idPartida: string;
  idPartidaPlanilha: string;
  rodada: number;
  /** aaaa-mm-dd */
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
  /** Kills do time A e do time B segundo o site (5f); null enquanto o site não respondeu. */
  killsSite: { timeA: number; timeB: number } | null;
}

/** Se o torneio pode ser calculado e, se não, quanto falta (5c). */
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

/** Uma pendência como GET /torneios/:id/pendencias devolve (5a). */
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
  /** Quanto falta para o "tentar agora" liberar; 0 = liberado. */
  segundosParaTentarAgora: number;
}

/** Um erro de campo do formulário, como a API devolve no 400. */
export interface ErroCampo {
  campo: string;
  mensagem: string;
}

/** Um erro de leitura da planilha (D18, D23), com a linha do Excel. */
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

/** Falha que a tela mostra como está: a API já devolve a frase pronta. */
export class ErroDaApi extends Error {}

export async function buscarSaude(): Promise<Saude> {
  const resposta = await fetch('/api/saude');
  // 503 também traz o corpo com o estado do banco
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

/** O arquivo vai direto no corpo, como veio; a API descobre a codificação (D18). */
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

/** Antecipa a próxima consulta das partidas aguardando o site; a API bloqueia 30 s entre cliques. */
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

/**
 * Marca (ciente = true) ou desfaz o Ciente. "mudou" = a API respondeu 404: a pendência não existe
 * mais, porque os dados mudaram enquanto a Maria olhava; a tela recarrega a lista.
 */
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

/**
 * Corrige o ID da partida (5b, D16). A partida volta para a fila. Os erros (formato, ID igual,
 * ID de outra partida) voltam com a frase da API, para a tela mostrar junto do campo.
 */
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

/**
 * Calcula os prêmios (6b). "recusado" = 409: algo mudou entre a tela e o clique (um Ciente
 * desfeito, uma partida de volta na fila) ou o torneio já foi calculado; vem com a frase da API.
 */
export async function calcularPremios(torneioId: number): Promise<{ tipo: 'ok' } | { tipo: 'recusado'; mensagem: string } | { tipo: 'erro'; mensagem: string }> {
  const resposta = await chamar(`/api/torneios/${torneioId}/calculo`, { method: 'POST' });
  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.ok) return { tipo: 'ok' };
  if (resposta.status === 409) return { tipo: 'recusado', mensagem: corpo.erro ?? 'Algo mudou: confira a página antes de calcular.' };
  return { tipo: 'erro', mensagem: corpo.erro ?? `Não foi possível calcular (erro ${resposta.status}).` };
}

async function chamar(caminho: string, opcoes?: RequestInit): Promise<Response> {
  try {
    return await fetch(caminho, opcoes);
  } catch {
    throw new ErroDaApi('Não foi possível falar com o servidor. Confira se o sistema está no ar e tente de novo.');
  }
}

async function lerOuFalhar<T>(resposta: Response): Promise<T> {
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new ErroDaApi(corpo?.erro ?? `O servidor respondeu com erro ${resposta.status}.`);
  return corpo as T;
}
