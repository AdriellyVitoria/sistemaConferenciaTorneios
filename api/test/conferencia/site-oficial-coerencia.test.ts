import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarClienteSiteOficial } from '../../src/conferencia/site-oficial';

/**
 * Code review, item 3: a resposta do site era validada no formato, mas não na coerência. Com o
 * vencedor "lobos" (e os times "Lobos" e "Corvos"), a classificação criava um time fantasma e o
 * cálculo quebrava; a Maria não teria como corrigir (o site é a verdade, D3). Agora a resposta
 * incoerente é "resposta_invalida": tentada de novo, com o motivo na aba "Aguardando o site".
 */

let resposta: unknown;
let servidor: Server;
let base: string;

beforeAll(async () => {
  servidor = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(resposta));
  });
  servidor.listen(0, '127.0.0.1');
  await new Promise((pronto) => servidor.once('listening', pronto));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((fechado) => servidor.close(() => fechado())));

const LOBOS_X_CORVOS = {
  id: '#48450',
  data: '2026-09-19',
  rodada: 5,
  times: ['Lobos', 'Corvos'],
  vencedor: 'Lobos',
  jogadores: [
    { nick: 'Lua_', time: 'Lobos', minutos: 41, kills: 20 },
    { nick: 'Zeca', time: 'Corvos', minutos: 41, kills: 1 },
  ],
};

async function consultar(partida: unknown, idConsultado = '#48450') {
  resposta = partida;
  return criarClienteSiteOficial({ urlBase: base, tempoLimiteMs: 5_000 }).consultarPartida(idConsultado);
}

function invalida(detalhe: string) {
  return { status: 'indisponivel', motivo: 'resposta_invalida', detalhe };
}

describe('coerência da resposta do site', () => {
  it('a partida coerente continua sendo aceita', async () => {
    expect(await consultar(LOBOS_X_CORVOS)).toEqual({ status: 'encontrada', partida: LOBOS_X_CORVOS });
  });

  it('vencedor "lobos" com os times "Lobos" e "Corvos": resposta inválida, tentada de novo', async () => {
    expect(await consultar({ ...LOBOS_X_CORVOS, vencedor: 'lobos' })).toEqual(
      invalida('O site oficial respondeu dados que não fecham: o vencedor "lobos" não é nenhum dos dois times (Lobos x Corvos).'),
    );
  });

  it('jogador de um time que não é da partida', async () => {
    const partida = { ...LOBOS_X_CORVOS, jogadores: [...LOBOS_X_CORVOS.jogadores, { nick: 'Garra', time: 'Leões', minutos: 41, kills: 3 }] };
    expect(await consultar(partida)).toEqual(
      invalida('O site oficial respondeu dados que não fecham: o jogador Garra está no time "Leões", que não é nenhum dos dois times (Lobos x Corvos).'),
    );
  });

  it('um dos times sem nenhum jogador', async () => {
    const partida = { ...LOBOS_X_CORVOS, jogadores: [LOBOS_X_CORVOS.jogadores[0]] };
    expect(await consultar(partida)).toEqual(
      invalida('O site oficial respondeu dados que não fecham: o time Corvos não tem nenhum jogador.'),
    );
  });

  it('lista de jogadores vazia: os dois times sem jogador', async () => {
    expect(await consultar({ ...LOBOS_X_CORVOS, jogadores: [] })).toEqual(
      invalida('O site oficial respondeu dados que não fecham: o time Lobos não tem nenhum jogador; o time Corvos não tem nenhum jogador.'),
    );
  });

  it('o ID da partida respondida é diferente do consultado', async () => {
    expect(await consultar(LOBOS_X_CORVOS, '#48451')).toEqual(
      invalida('O site oficial respondeu dados que não fecham: a partida respondida é a #48450, e não a consultada (#48451).'),
    );
  });

  it('os dois times com o mesmo nome', async () => {
    const partida = { ...LOBOS_X_CORVOS, times: ['Lobos', 'Lobos'], jogadores: [LOBOS_X_CORVOS.jogadores[0]] };
    expect(await consultar(partida)).toEqual(
      invalida('O site oficial respondeu dados que não fecham: os dois times têm o mesmo nome (Lobos).'),
    );
  });
});

describe('limites da resposta do site (os mesmos da planilha, R1a)', () => {
  it('nick com mais de 80 caracteres: inválida, em vez de 500 ao gravar as participações', async () => {
    const nick = 'n'.repeat(81);
    const partida = { ...LOBOS_X_CORVOS, jogadores: [{ ...LOBOS_X_CORVOS.jogadores[0], nick }, LOBOS_X_CORVOS.jogadores[1]] };
    expect(await consultar(partida)).toEqual(invalida('O site oficial respondeu fora do formato esperado (campos: jogadores.0.nick).'));
  });

  it('kills acima de 100.000: inválida', async () => {
    const partida = { ...LOBOS_X_CORVOS, jogadores: [{ ...LOBOS_X_CORVOS.jogadores[0], kills: 100_001 }, LOBOS_X_CORVOS.jogadores[1]] };
    expect(await consultar(partida)).toEqual(invalida('O site oficial respondeu fora do formato esperado (campos: jogadores.0.kills).'));
  });

  it('nome de time com mais de 80 caracteres: inválida', async () => {
    const time = 't'.repeat(81);
    const partida = { ...LOBOS_X_CORVOS, times: [time, 'Corvos'], vencedor: time, jogadores: [{ ...LOBOS_X_CORVOS.jogadores[0], time }, LOBOS_X_CORVOS.jogadores[1]] };
    const resultado = await consultar(partida);
    expect(resultado).toMatchObject({ status: 'indisponivel', motivo: 'resposta_invalida' });
    expect(resultado.status === 'indisponivel' && resultado.detalhe).toContain('times.0');
  });
});

describe('os dados do simulador continuam todos válidos', () => {
  it('as 148 partidas de testes/site-oficial.json e de setembro passam pela validação nova', async () => {
    const RAIZ = path.resolve(__dirname, '../../..');
    const arquivos = ['testes/site-oficial.json', 'api/test/fixtures/site-setembro.json'];
    const partidas = arquivos.flatMap((a) => Object.values(JSON.parse(readFileSync(path.join(RAIZ, a), 'utf8'))) as { id: string }[]);
    expect(partidas).toHaveLength(148);
    for (const partida of partidas) {
      const resultado = await consultar(partida, partida.id);
      expect(resultado.status, `${partida.id}: ${JSON.stringify(resultado)}`).toBe('encontrada');
    }
  });
});
