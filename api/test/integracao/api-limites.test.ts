import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../../src/app';
import { conectarAoBancoDeTeste, esvaziarTabelas } from './banco-de-teste';
import { COM_SENHA, SENHA_DE_TESTE } from '../ajudantes/senha';

const RAIZ = path.resolve(__dirname, '../../..');
const SETEMBRO = readFileSync(path.join(RAIZ, 'torneio-setembro.csv'), 'utf8');
const LINHA_7 = '05/09/2026;1;#45659;Lobos x Serpentes;Serpentes;Kaio_BR;43;8;não';

let bd: Knex;
let servidor: Server;
let base: string;

beforeAll(async () => {
  bd = conectarAoBancoDeTeste();
  servidor = criarApp({ bd, verificarBanco: async () => {}, senhaDaOrganizadora: SENHA_DE_TESTE }).listen(0);
  await new Promise((pronto) => servidor.once('listening', pronto));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((fechado) => servidor.close(() => fechado()));
  await bd.destroy();
});
beforeEach(async () => {
  await esvaziarTabelas(bd);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

async function pedir(metodo: string, caminho: string, corpo?: unknown) {
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { ...COM_SENHA, ...(corpo instanceof Uint8Array ? {} : { 'content-type': 'application/json' }) },
    body: corpo === undefined ? undefined : corpo instanceof Uint8Array ? corpo : JSON.stringify(corpo),
  });
  return { status: resposta.status, corpo: await resposta.json() };
}

async function criarTorneio(): Promise<number> {
  const { corpo } = await pedir('POST', '/torneios', { nome: 'Limites', premioCentavos: 1_000_000, percentuais: [50, 30, 20], modoDivisao: 'minutos' });
  return corpo.id;
}

function setembroComLinha7(linha: string): Uint8Array {
  if (!SETEMBRO.includes(LINHA_7)) throw new Error('a linha 7 de setembro mudou');
  return Buffer.from(SETEMBRO.replace(LINHA_7, linha), 'utf8');
}

async function subirERecusar(conteudo: Uint8Array) {
  const id = await criarTorneio();
  const resposta = await pedir('PUT', `/torneios/${id}/planilha`, conteudo);
  expect((await pedir('GET', `/torneios/${id}`)).corpo.partidas).toEqual([]);
  return resposta;
}

describe('PUT /torneios/:id/planilha — valores acima do limite: 400 com a linha, não 500', () => {
  it('nick com 81 caracteres', async () => {
    const { status, corpo } = await subirERecusar(setembroComLinha7(LINHA_7.replace('Kaio_BR', 'k'.repeat(81))));
    expect(status).toBe(400);
    expect(corpo.erros).toEqual([expect.objectContaining({ linha: 7, coluna: 'Nick', mensagem: 'O nick pode ter até 80 caracteres. Este tem 81.' })]);
  });

  it('time com 81 caracteres', async () => {
    const { status, corpo } = await subirERecusar(setembroComLinha7(LINHA_7.replace(';Serpentes;', `;${'s'.repeat(81)};`)));
    expect(status).toBe(400);
    expect(corpo.erros).toEqual([expect.objectContaining({ linha: 7, coluna: 'Time' })]);
  });

  it('coluna Partida com 201 caracteres', async () => {
    const { status, corpo } = await subirERecusar(setembroComLinha7(LINHA_7.replace('Lobos x Serpentes', 'x'.repeat(201))));
    expect(status).toBe(400);
    expect(corpo.erros).toEqual([expect.objectContaining({ linha: 7, coluna: 'Partida' })]);
  });

  it('ID da partida com 25 dígitos', async () => {
    const idLongo = `#${'4'.repeat(25)}`;
    const { status, corpo } = await subirERecusar(setembroComLinha7(LINHA_7.replace('#45659', idLongo)));
    expect(status).toBe(400);
    expect(corpo.erros).toEqual([expect.objectContaining({
      linha: 7, coluna: 'ID Partida', mensagem: `O ID da partida pode ter até 19 números. Veio "${idLongo}", com 25.`,
    })]);
  });

  it('kills 5.000.000.000 e minutos 100.001', async () => {
    const { status, corpo } = await subirERecusar(setembroComLinha7(LINHA_7.replace(';43;8;', ';100001;5000000000;')));
    expect(status).toBe(400);
    expect(corpo.erros.map((e: { coluna: string }) => e.coluna)).toEqual(['Minutos', 'Kills']);
  });

  it('rodada maior que a coluna aguenta', async () => {
    const { status, corpo } = await subirERecusar(setembroComLinha7(LINHA_7.replace('/2026;1;', '/2026;4294967296;')));
    expect(status).toBe(400);
    expect(corpo.erros).toEqual([expect.objectContaining({ linha: 7, coluna: 'Rodada' })]);
  });

  it('data com ano 0001', async () => {
    const { status, corpo } = await subirERecusar(setembroComLinha7(LINHA_7.replace('05/09/2026', '01/01/0001')));
    expect(status).toBe(400);
    expect(corpo.erros).toEqual([expect.objectContaining({ linha: 7, coluna: 'Data', mensagem: 'O ano da data precisa estar entre 2000 e 2100. Veio "01/01/0001".' })]);
  });

  it('arquivo .xlsx: uma frase só', async () => {
    const xlsx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(2_000, 7)]);
    const { status, corpo } = await subirERecusar(xlsx);
    expect(status).toBe(400);
    expect(corpo.erros).toEqual([{ mensagem: 'Este arquivo é do Excel (.xlsx). No Excel, use Salvar como → CSV UTF-8 (separado por vírgulas).' }]);
  });
});

describe('PUT /torneios/:id/partidas/:partidaId/id-partida — ID longo demais: 400, não 500', () => {
  it('corrigir para 30 dígitos é recusado com a frase de limite, e o ID antigo continua', async () => {
    const id = await criarTorneio();
    expect((await pedir('PUT', `/torneios/${id}/planilha`, Buffer.from(SETEMBRO, 'utf8'))).status).toBe(200);
    const partida = (await pedir('GET', `/torneios/${id}`)).corpo.partidas.find((p: { idPartida: string }) => p.idPartida === '#45659');

    const { status, corpo } = await pedir('PUT', `/torneios/${id}/partidas/${partida.id}/id-partida`, { idPartida: '1'.repeat(30) });
    expect(status).toBe(400);
    expect(corpo.erro).toBe(`O ID da partida pode ter até 19 números. Veio "${'1'.repeat(30)}", com 30.`);
    expect((await bd('partidas').where({ id: partida.id }).first()).id_partida).toBe('#45659');
  });
});
