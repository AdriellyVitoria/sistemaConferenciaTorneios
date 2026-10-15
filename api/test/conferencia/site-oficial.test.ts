import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarClienteSiteOficial, type Cronometro } from '../../src/conferencia/site-oficial';

// Servidor falso no lugar do site oficial: cada teste diz como ele responde.
type Atendimento = (req: IncomingMessage, res: ServerResponse) => void;
let atender: Atendimento;
let pedidos: string[];
let servidor: Server;
let base: string;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    pedidos.push(req.url ?? '');
    atender(req, res);
  });
  servidor.listen(0, '127.0.0.1');
  await new Promise((pronto) => servidor.once('listening', pronto));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(async () => {
  servidor.closeAllConnections();
  await new Promise<void>((fechado) => servidor.close(() => fechado()));
});
beforeEach(() => {
  pedidos = [];
});

const json = (status: number, corpo: unknown): Atendimento => (_req, res) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(corpo));
};

/**
 * Cronômetro de mentira: em vez de esperar o tempo limite, o teste decide quando ele esgota.
 * Guarda o tempo pedido e se o cliente cancelou o cronômetro (para não deixar timer pendurado).
 */
function cronometroDeTeste() {
  const estado = { pedidoMs: null as number | null, esgotar: () => {}, cancelado: false, iniciado: Promise.withResolvers<void>() };
  const cronometro: Cronometro = (ms, aoEsgotar) => {
    estado.pedidoMs = ms;
    estado.esgotar = aoEsgotar;
    estado.iniciado.resolve();
    return () => {
      estado.cancelado = true;
    };
  };
  return { estado, cronometro };
}

const PARTIDA = {
  id: '#40923',
  data: '2026-09-19',
  rodada: 5,
  times: ['Falcões', 'Panteras'],
  vencedor: 'Falcões',
  jogadores: [
    { nick: 'Falk', time: 'Falcões', minutos: 38, kills: 14 },
    { nick: 'Sombra', time: 'Panteras', minutos: 38, kills: 7 },
  ],
};

function cliente(cronometro?: Cronometro, urlBase = base) {
  return criarClienteSiteOficial({ urlBase, tempoLimiteMs: 15_000, cronometro });
}

describe('cliente do site oficial: os cinco casos', () => {
  it('200: partida encontrada, com os dados; a URL vai só com os números do ID', async () => {
    atender = json(200, PARTIDA);
    const { estado, cronometro } = cronometroDeTeste();

    expect(await cliente(cronometro).consultarPartida('#40923')).toEqual({ status: 'encontrada', partida: PARTIDA });
    expect(pedidos).toEqual(['/partidas/40923']);
    expect(estado.cancelado).toBe(true); // respondeu a tempo: o cronômetro é desligado
  });

  it('404: não encontrada (vira pendência de corrigir o ID, D5)', async () => {
    atender = json(404, { status: 'nao_encontrada', id: '#52214' });
    expect(await cliente().consultarPartida('#52214')).toEqual({ status: 'nao_encontrada' });
  });

  it('503: indisponível, para tentar de novo', async () => {
    atender = json(503, { status: 'indisponivel', id: '#40923' });
    expect(await cliente().consultarPartida('#40923')).toEqual({
      status: 'indisponivel',
      motivo: 'site_fora_do_ar',
      detalhe: 'O site oficial respondeu que está fora do ar (erro 503).',
    });
  });

  it('sem resposta dentro do tempo limite: indisponível, sem o teste esperar de verdade', async () => {
    atender = () => {}; // o site recebe o pedido e nunca responde
    const { estado, cronometro } = cronometroDeTeste();

    const consulta = cliente(cronometro).consultarPartida('#40923');
    await estado.iniciado.promise;
    expect(estado.pedidoMs).toBe(15_000);
    estado.esgotar();

    expect(await consulta).toEqual({
      status: 'indisponivel',
      motivo: 'tempo_esgotado',
      detalhe: 'O site oficial não respondeu em 15 segundos.',
    });
  });

  it('erro de rede (ninguém escutando no endereço): indisponível', async () => {
    const fechado = createServer();
    fechado.listen(0, '127.0.0.1');
    await new Promise((pronto) => fechado.once('listening', pronto));
    const enderecoSemSite = `http://127.0.0.1:${(fechado.address() as AddressInfo).port}`;
    await new Promise<void>((pronto) => fechado.close(() => pronto()));

    const resultado = await cliente(undefined, enderecoSemSite).consultarPartida('#40923');
    expect(resultado).toMatchObject({ status: 'indisponivel', motivo: 'erro_de_rede' });
    expect(resultado.status === 'indisponivel' && resultado.detalhe).toMatch(/^Não foi possível conectar ao site oficial/);
  });
});

describe('cliente do site oficial: outras respostas', () => {
  it('o site manda o cabeçalho e trava no meio do corpo: o tempo limite vale até o fim da leitura', async () => {
    atender = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write('{"id":"#40923",'); // e nunca termina
    };
    const { estado, cronometro } = cronometroDeTeste();

    const consulta = cliente(cronometro).consultarPartida('#40923');
    await estado.iniciado.promise;
    await new Promise((pronto) => setTimeout(pronto, 50)); // deixa o cabeçalho chegar
    estado.esgotar();

    expect(await consulta).toMatchObject({ status: 'indisponivel', motivo: 'tempo_esgotado' });
  });

  it.each([500, 502, 504])('erro %i do servidor: indisponível', async (codigo) => {
    atender = json(codigo, { erro: 'falhou' });
    expect(await cliente().consultarPartida('#40923')).toEqual({
      status: 'indisponivel',
      motivo: 'erro_do_site',
      detalhe: `O site oficial respondeu com o erro ${codigo}.`,
    });
  });

  it('400 (o site recusou o pedido): indisponível, com o motivo para a tela', async () => {
    atender = json(400, { erro: 'ID de partida inválido' });
    expect(await cliente().consultarPartida('#40923')).toEqual({
      status: 'indisponivel',
      motivo: 'erro_do_site',
      detalhe: 'O site oficial respondeu com o erro 400.',
    });
  });

  it.each([
    ['corpo que não é JSON', 'isto não é json'],
    ['sem jogadores', JSON.stringify({ ...PARTIDA, jogadores: undefined })],
    ['minutos com texto', JSON.stringify({ ...PARTIDA, jogadores: [{ ...PARTIDA.jogadores[0], minutos: '38' }] })],
    ['kills negativos', JSON.stringify({ ...PARTIDA, jogadores: [{ ...PARTIDA.jogadores[0], kills: -1 }] })],
    ['três times', JSON.stringify({ ...PARTIDA, times: ['A', 'B', 'C'] })],
  ])('200 com resposta fora do formato (%s): indisponível, nunca dado pela metade', async (_caso, corpo) => {
    atender = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(corpo);
    };
    expect(await cliente().consultarPartida('#40923')).toMatchObject({
      status: 'indisponivel',
      motivo: 'resposta_invalida',
    });
  });

  it('campos a mais na resposta são ignorados', async () => {
    atender = json(200, { ...PARTIDA, servidor: 'br-2', jogadores: PARTIDA.jogadores.map((j) => ({ ...j, ping: 40 })) });
    expect(await cliente().consultarPartida('#40923')).toEqual({ status: 'encontrada', partida: PARTIDA });
  });

  it('recusa criar o cliente com tempo limite que não é inteiro positivo', () => {
    expect(() => criarClienteSiteOficial({ urlBase: base, tempoLimiteMs: 0 })).toThrow('tempo limite');
  });
});
