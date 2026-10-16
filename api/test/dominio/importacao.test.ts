import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { montarPartidas } from '../../src/dominio/importacao';
import { lerPlanilha, type LinhaPlanilha } from '../../src/dominio/planilha';

const RAIZ = path.resolve(__dirname, '../../..');

function linhasDe(arquivo: string): LinhaPlanilha[] {
  const resultado = lerPlanilha(readFileSync(path.join(RAIZ, arquivo)));
  if (!resultado.ok) throw new Error(`planilha inválida: ${arquivo}`);
  return resultado.linhas;
}

let proxima = 2;
const linha = (idPartida: string, time: string, nick: string, extra: Partial<LinhaPlanilha> = {}): LinhaPlanilha => ({
  numeroLinha: proxima++, data: '2026-09-05', rodada: 1, idPartida, partida: 'Lobos x Serpentes',
  time, nick, minutos: 40, kills: 5, venceu: time === 'Lobos', ...extra,
});

describe('montarPartidas', () => {
  it('setembro: uma partida por ID, com os dois times na ordem em que aparecem', () => {
    const resultado = montarPartidas(linhasDe('torneio-setembro.csv'));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.partidas).toHaveLength(15);
    expect(resultado.partidas[0]).toEqual({ idPartida: '#45659', rodada: 1, data: '2026-09-05', timeA: 'Lobos', timeB: 'Serpentes' });
    expect(resultado.partidas.find((p) => p.idPartida === '#40923')).toEqual({
      idPartida: '#40923', rodada: 5, data: '2026-09-19', timeA: 'Falcões', timeB: 'Panteras',
    });
  });

  it('partida com um time só: erro dizendo o problema e a linha (D23)', () => {
    proxima = 2;
    const resultado = montarPartidas([
      linha('#45659', 'Lobos', 'Lua_'),
      linha('#45659', 'Serpentes', 'Naja'),
      linha('#45659', 'Serpentes', 'Bote'),
      linha('#45659', 'Lobos', 'Pipoca'),
      linha('#45659', 'Serpentes', 'Víbora'),
      linha('#45695', 'Lobos', 'R4mbo'),
    ]);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.erros).toEqual([{
      linha: 7,
      linhas: [7],
      coluna: 'ID Partida',
      valor: '#45695',
      mensagem: 'A partida #45695 tem só o time Lobos (linha 7). Toda partida precisa ter dois times. Confira o ID.',
    }]);
  });

  it('um time só em várias linhas: lista todas', () => {
    proxima = 10;
    const resultado = montarPartidas([linha('#1', 'Lobos', 'A'), linha('#1', 'Lobos', 'B'), linha('#1', 'Lobos', 'C')]);
    expect(!resultado.ok && resultado.erros[0].mensagem).toBe(
      'A partida #1 tem só o time Lobos (linhas 10, 11 e 12). Toda partida precisa ter dois times. Confira o ID.',
    );
  });

  it('três times: lista as linhas de cada time', () => {
    proxima = 2;
    const resultado = montarPartidas([
      linha('#45659', 'Lobos', 'Lua_'),
      linha('#45659', 'Lobos', 'Pipoca'),
      linha('#45659', 'Serpentes', 'Naja'),
      linha('#45659', 'Corvos', 'Zeca'),
      linha('#45659', 'Serpentes', 'Bote'),
    ]);
    expect(!resultado.ok && resultado.erros).toEqual([{
      linha: 2,
      linhas: [2, 3, 4, 5, 6],
      coluna: 'ID Partida',
      valor: '#45659',
      mensagem:
        'A partida #45659 tem 3 times: Lobos (linhas 2 e 3), Serpentes (linhas 4 e 6) e Corvos (linha 5). ' +
        'Toda partida precisa ter dois times. Confira o ID das linhas do time que não é desta partida.',
    }]);
  });

  it('o mesmo time escrito com e sem acento não vira um terceiro time (D19)', () => {
    proxima = 2;
    const resultado = montarPartidas([
      linha('#40923', 'Falcões', 'Falk'),
      linha('#40923', 'Falcoes', 'Kiwi'),
      linha('#40923', 'Panteras', 'Mel'),
    ]);
    expect(resultado.ok && resultado.partidas).toEqual([
      { idPartida: '#40923', rodada: 1, data: '2026-09-05', timeA: 'Falcões', timeB: 'Panteras' },
    ]);
  });

  it('data ou rodada diferentes entre as linhas de um ID: vale a primeira linha (D19)', () => {
    proxima = 2;
    const resultado = montarPartidas([
      linha('#1', 'Lobos', 'A', { rodada: 2, data: '2026-09-06' }),
      linha('#1', 'Serpentes', 'B', { rodada: 3, data: '2026-09-07' }),
    ]);
    expect(resultado.ok && resultado.partidas[0]).toMatchObject({ rodada: 2, data: '2026-09-06' });
  });

  it('junta os erros de todas as partidas, na ordem das linhas', () => {
    proxima = 2;
    const resultado = montarPartidas([
      linha('#1', 'Lobos', 'A'),
      linha('#2', 'Corvos', 'B'),
      linha('#2', 'Panteras', 'C'),
      linha('#3', 'Tubarões', 'D'),
    ]);
    expect(!resultado.ok && resultado.erros.map((e) => e.valor)).toEqual(['#1', '#3']);
  });
});
