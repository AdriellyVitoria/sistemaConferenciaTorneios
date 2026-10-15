/**
 * Uma API falsa, em memória, no lugar do fetch: responde como a API de verdade às rotas que a
 * página do torneio usa e guarda o estado (um Ciente marcado aparece marcado na próxima leitura).
 */

import { vi } from 'vitest';

type Pendencia = {
  chave: string;
  tipo: string;
  idPartida: string | null;
  partidas?: string[];
  nick?: string;
  campo?: string;
  valorPlanilha: string | null;
  valorSite: string | null;
  acao: 'ciente' | 'corrigir_id';
  mensagem: string;
  bloqueante: boolean;
  ciente: boolean;
  cienteEm: string | null;
};

const partida = (id: number, idPartida: string, rodada: number, timeA: string, timeB: string, statusConferencia = 'conferida') => ({
  id, torneioId: 1, idPartida, idPartidaPlanilha: idPartida, rodada, data: '2026-09-06', timeA, timeB, vencedor: timeA,
  statusConferencia, tentativas: 0, proximaTentativaEm: null, ultimaTentativaEm: '2026-10-15T12:00:00.000Z',
  emConsultaDesde: null, ultimoErro: null, origemDoErro: null,
});

const chave = (letra: string) => letra.repeat(64);

export function criarApiFalsa({ calculado = false } = {}) {
  const pendencias: Pendencia[] = [
    {
      chave: chave('a'), tipo: 'nao_encontrada', idPartida: '#52214', valorPlanilha: '#52214', valorSite: null, acao: 'corrigir_id',
      mensagem: 'O site não encontrou a partida #52214. Confira o ID na planilha e corrija.', bloqueante: true, ciente: false, cienteEm: null,
    },
    {
      chave: chave('b'), tipo: 'duplicata', idPartida: '#46065', nick: 'Pantera_X',
      valorPlanilha: '2 vezes: 42 min, 8 kills / 42 min, 8 kills', valorSite: '42 min, 8 kills', acao: 'ciente',
      mensagem: 'Pantera_X aparece 2 vezes na partida #46065 (linhas 38 e 39). No site aparece uma vez; usamos os dados do site.',
      bloqueante: false, ciente: false, cienteEm: null,
    },
    {
      chave: chave('c'), tipo: 'nick_diferente', idPartida: '#48087', nick: 'xXSniperXx', valorPlanilha: 'xxsniperxx', valorSite: 'xXSniperXx', acao: 'ciente',
      mensagem: 'Na partida #48087, o nick está escrito "xxsniperxx" na planilha e "xXSniperXx" no site. Usamos o nick do site.',
      bloqueante: false, ciente: false, cienteEm: null,
    },
    {
      chave: chave('d'), tipo: 'sem_dados_planilha', idPartida: '#40923', valorPlanilha: 'sem dados', valorSite: 'Falcões venceu', acao: 'ciente',
      mensagem: 'A partida #40923 está sem dados na planilha (0 minutos, 0 kills e sem vencedor). Usamos os dados do site: Falcões venceu.',
      bloqueante: false, ciente: false, cienteEm: null,
    },
  ];
  const partidas = [
    partida(1, '#45659', 1, 'Lobos', 'Serpentes'),
    partida(2, '#46065', 2, 'Lobos', 'Panteras'),
    partida(3, '#48087', 3, 'Lobos', 'Falcões'),
    partida(4, '#40923', 5, 'Falcões', 'Panteras'),
    partida(5, '#52214', 2, 'Águias', 'Lobos-Guará', 'nao_encontrada'),
  ];
  const estado = {
    calculado,
    /** A próxima marcação desta chave responde 404: os dados mudaram enquanto a Maria olhava. */
    mudarAoMarcar: null as string | null,
    pedidos: [] as string[],
  };

  const lista = () => {
    const bloqueantes = pendencias.filter((p) => p.bloqueante);
    const naoBloqueantes = pendencias.filter((p) => !p.bloqueante);
    const comCiente = naoBloqueantes.filter((p) => p.ciente).length;
    return {
      bloqueantes,
      naoBloqueantes,
      resumo: { bloqueantes: bloqueantes.length, naoBloqueantes: naoBloqueantes.length, comCiente, semCiente: naoBloqueantes.length - comCiente, aguardandoSite: 0 },
    };
  };
  const torneio = () => {
    const { resumo } = lista();
    return {
      id: 1, nome: 'Torneio de setembro', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos',
      status: estado.calculado ? 'calculado' : 'importado', calculadoEm: estado.calculado ? '2026-10-15T13:00:00.000Z' : null,
      planilhaArquivo: 'torneio-setembro.csv', planilhaImportadaEm: '2026-10-15T11:00:00.000Z', planilhaConvertidaDeWindows1252: false,
      criadoEm: '2026-10-15T11:00:00.000Z', tentarAgoraEm: null, segundosParaTentarAgora: 0, partidas,
      calculo: {
        podeCalcular: !estado.calculado && resumo.bloqueantes === 0 && resumo.semCiente === 0,
        calculado: estado.calculado, calculadoEm: null, semPlanilha: false, aguardandoSite: 0, bloqueios: resumo.bloqueantes, semCiente: resumo.semCiente,
      },
    };
  };

  const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

  const fetchFalso = vi.fn(async (url: string | URL, opcoes: RequestInit = {}) => {
    const caminho = String(url);
    const metodo = (opcoes.method ?? 'GET').toUpperCase();
    estado.pedidos.push(`${metodo} ${caminho}`);

    if (metodo === 'GET' && caminho === '/api/saude') return json(200, { api: 'ok', banco: 'ok' });
    if (metodo === 'GET' && caminho === '/api/torneios/1') return json(200, torneio());
    if (metodo === 'GET' && caminho === '/api/torneios/1/pendencias') return json(200, lista());

    const ciente = /^\/api\/torneios\/1\/pendencias\/([0-9a-f]{64})\/ciente$/.exec(caminho);
    if (ciente && (metodo === 'PUT' || metodo === 'DELETE')) {
      if (estado.calculado) return json(409, { erro: 'O torneio já foi calculado: os Cientes não podem mais mudar.' });
      const p = pendencias.find((x) => x.chave === ciente[1]);
      if (!p || estado.mudarAoMarcar === p.chave) {
        if (p) {
          // o site respondeu de novo com outro valor: é outra pendência, com outra chave
          p.chave = chave('e');
          p.valorSite = '40 min, 8 kills';
          estado.mudarAoMarcar = null;
        }
        return json(404, { erro: 'Esta pendência não existe mais: os dados mudaram. Atualize a lista e confira de novo.' });
      }
      if (p.bloqueante) return json(409, { erro: 'Esta pendência não aceita Ciente: ela se resolve corrigindo o ID da partida.' });
      p.ciente = metodo === 'PUT';
      p.cienteEm = p.ciente ? '2026-10-15T12:30:00.000Z' : null;
      return json(200, { chave: p.chave, ciente: p.ciente });
    }

    if (metodo === 'POST' && caminho === '/api/torneios/1/pendencias/ciente-de-todas') {
      if (estado.calculado) return json(409, { erro: 'O torneio já foi calculado: os Cientes não podem mais mudar.' });
      const semCiente = pendencias.filter((p) => !p.bloqueante && !p.ciente);
      for (const p of semCiente) {
        p.ciente = true;
        p.cienteEm = '2026-10-15T12:30:00.000Z';
      }
      return json(200, { marcadas: semCiente.length });
    }

    return json(404, { erro: `rota falsa não encontrada: ${metodo} ${caminho}` });
  });

  vi.stubGlobal('fetch', fetchFalso);
  return { estado, pendencias, chave };
}
