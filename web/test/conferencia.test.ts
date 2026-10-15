import { describe, expect, it } from 'vitest';
import {
  estadoDoTentarAgora,
  formatarHora,
  precisaAcompanhar,
  progressoDaConferencia,
  segundosAte,
  situacaoNaFila,
} from '../src/dominio/conferencia';
import type { Partida, StatusConferencia } from '../src/servicos/api';

const FUSO = 'America/Sao_Paulo';
// 12:00:00 em Brasília
const AGORA = new Date('2026-10-14T15:00:00.000Z');
const daqui = (ms: number) => new Date(AGORA.getTime() + ms).toISOString();

let proximoId = 1;
function partida(statusConferencia: StatusConferencia, extra: Partial<Partida> = {}): Partida {
  return {
    id: proximoId++,
    idPartida: '#40923',
    idPartidaPlanilha: '#40923',
    rodada: 5,
    data: '2026-09-19',
    timeA: 'Falcões',
    timeB: 'Panteras',
    vencedor: null,
    statusConferencia,
    tentativas: 0,
    proximaTentativaEm: null,
    ultimaTentativaEm: null,
    emConsultaDesde: null,
    ultimoErro: null,
    origemDoErro: null,
    ...extra,
  };
}

describe('progressoDaConferencia: a barra "X de N conferidas"', () => {
  it('conta conferidas, as que ainda dependem do site e o percentual (inteiro, para baixo)', () => {
    const partidas = [
      ...Array.from({ length: 10 }, () => partida('conferida')),
      partida('aguardando'),
      partida('aguardando'),
      partida('em_consulta'),
      partida('nao_encontrada'),
      partida('times_diferentes'),
    ];
    expect(progressoDaConferencia(partidas)).toEqual({ conferidas: 10, total: 15, aguardandoOSite: 3, percentual: 66 });
  });

  it('sem partidas: 0 de 0, sem dividir por zero', () => {
    expect(progressoDaConferencia([])).toEqual({ conferidas: 0, total: 0, aguardandoOSite: 0, percentual: 0 });
  });

  it('tudo conferido: 100%', () => {
    expect(progressoDaConferencia([partida('conferida'), partida('conferida')]).percentual).toBe(100);
  });
});

describe('precisaAcompanhar: a tela só consulta a API enquanto houver o que esperar', () => {
  it('com partida aguardando ou em consulta: sim', () => {
    expect(precisaAcompanhar([partida('conferida'), partida('aguardando')])).toBe(true);
    expect(precisaAcompanhar([partida('conferida'), partida('em_consulta')])).toBe(true);
  });

  it('só conferidas, não encontradas ou times diferentes (dependem da Maria, não do site): não', () => {
    expect(precisaAcompanhar([partida('conferida'), partida('nao_encontrada'), partida('times_diferentes')])).toBe(false);
    expect(precisaAcompanhar([])).toBe(false);
  });
});

describe('estadoDoTentarAgora', () => {
  const comAguardando = [partida('conferida'), partida('aguardando')];

  it('com partida aguardando e sem bloqueio: liberado', () => {
    expect(estadoDoTentarAgora({ partidas: comAguardando, segundosParaTentarAgora: 0, status: 'conferindo' })).toEqual({
      habilitado: true,
      rotulo: 'Tentar agora',
      motivo: null,
    });
  });

  it('no bloqueio de 30 s: desabilitado, com a contagem', () => {
    expect(estadoDoTentarAgora({ partidas: comAguardando, segundosParaTentarAgora: 18, status: 'conferindo' })).toEqual({
      habilitado: false,
      rotulo: 'Tentar agora (18 s)',
      motivo: 'Aguarde 18 segundos para tentar de novo.',
    });
    expect(estadoDoTentarAgora({ partidas: comAguardando, segundosParaTentarAgora: 1, status: 'conferindo' }).motivo).toBe(
      'Aguarde 1 segundo para tentar de novo.',
    );
  });

  it('só em consulta, sem nenhuma aguardando: desabilitado (nada em paralelo)', () => {
    expect(estadoDoTentarAgora({ partidas: [partida('em_consulta')], segundosParaTentarAgora: 0, status: 'conferindo' })).toEqual({
      habilitado: false,
      rotulo: 'Tentar agora',
      motivo: 'Não há partida aguardando o site.',
    });
  });

  it('depois do cálculo: desabilitado', () => {
    expect(estadoDoTentarAgora({ partidas: comAguardando, segundosParaTentarAgora: 0, status: 'calculado' })).toMatchObject({
      habilitado: false,
      motivo: 'Os prêmios já foram calculados.',
    });
  });
});

describe('situacaoNaFila: cada partida da aba "Aguardando o site"', () => {
  it('ainda não consultada', () => {
    expect(situacaoNaFila(partida('aguardando', { proximaTentativaEm: daqui(-1_000) }), AGORA, FUSO)).toEqual({
      selo: { texto: 'Na fila', tom: 'neutro' },
      motivo: null,
      horario: 'Primeira consulta em instantes',
    });
  });

  it('em consulta agora', () => {
    expect(situacaoNaFila(partida('em_consulta', { emConsultaDesde: daqui(-4_000) }), AGORA, FUSO)).toEqual({
      selo: { texto: 'Consultando o site', tom: 'info' },
      motivo: null,
      horario: 'Consultando desde 11:59:56',
    });
  });

  it('o site falhou: o motivo, quantas tentativas e "última às X, próxima às Y" (D10)', () => {
    const p = partida('aguardando', {
      tentativas: 3,
      ultimaTentativaEm: daqui(-2 * 60_000),
      proximaTentativaEm: daqui(3 * 60_000),
      ultimoErro: 'O site oficial respondeu que está fora do ar (erro 503).',
      origemDoErro: 'site',
    });
    expect(situacaoNaFila(p, AGORA, FUSO)).toEqual({
      selo: { texto: 'O site falhou · 3 tentativas', tom: 'alerta' },
      motivo: 'O site oficial respondeu que está fora do ar (erro 503).',
      horario: 'Última tentativa às 11:58:00, próxima às 12:03:00',
    });
  });

  it('uma tentativa: no singular', () => {
    const p = partida('aguardando', { tentativas: 1, ultimaTentativaEm: daqui(-1_000), proximaTentativaEm: daqui(59_000), ultimoErro: 'x', origemDoErro: 'site' });
    expect(situacaoNaFila(p, AGORA, FUSO).selo.texto).toBe('O site falhou · 1 tentativa');
  });

  it('erro interno: o selo deixa claro que não é o site', () => {
    const p = partida('aguardando', {
      ultimaTentativaEm: daqui(-10_000),
      proximaTentativaEm: daqui(50_000),
      ultimoErro: 'Erro inesperado ao conferir a partida; ela será consultada de novo.',
      origemDoErro: 'interno',
    });
    expect(situacaoNaFila(p, AGORA, FUSO)).toEqual({
      selo: { texto: 'Erro interno, não é o site', tom: 'erro' },
      motivo: 'Erro inesperado ao conferir a partida; ela será consultada de novo.',
      horario: 'Última tentativa às 11:59:50, próxima às 12:00:50',
    });
  });

  it('a próxima tentativa já chegou (por exemplo, depois do "tentar agora"): "próxima em instantes"', () => {
    const p = partida('aguardando', { tentativas: 2, ultimaTentativaEm: daqui(-30_000), proximaTentativaEm: daqui(-1_000), ultimoErro: 'x', origemDoErro: 'site' });
    expect(situacaoNaFila(p, AGORA, FUSO).horario).toBe('Última tentativa às 11:59:30, próxima em instantes');
  });
});

describe('formatarHora e segundosAte', () => {
  it('hora no fuso informado', () => {
    expect(formatarHora('2026-10-14T15:03:09.000Z', FUSO)).toBe('12:03:09');
  });

  it('segundos até um horário, para cima e nunca negativo', () => {
    expect(segundosAte(AGORA.getTime() + 17_500, AGORA.getTime())).toBe(18);
    expect(segundosAte(AGORA.getTime() + 1, AGORA.getTime())).toBe(1);
    expect(segundosAte(AGORA.getTime(), AGORA.getTime())).toBe(0);
    expect(segundosAte(AGORA.getTime() - 5_000, AGORA.getTime())).toBe(0);
  });
});
