import { describe, expect, it } from 'vitest';
import { csvDoResultado, nomeDoArquivoCsv } from '../../src/dominio/csv-resultado';

type Jogador = Parameters<typeof csvDoResultado>[0][number];
const j = (posicao: number, time: string, nick: string, premioCentavos: number, extra: Partial<Jogador> = {}): Jogador => ({
  posicao, time, nick, minutos: 30, kills: 10, premioCentavos, recebeuCentavo: false, ...extra,
});

const linhas = (csv: string) => csv.split('\r\n');

describe('csvDoResultado: a planilha para a Maria pagar no Excel', () => {
  it('separador ";", linhas CRLF e o cabeçalho em português', () => {
    const csv = csvDoResultado([j(1, 'Lobos', 'Lua_', 100_000)]);
    expect(linhas(csv)[0]).toBe('Posição;Time;Nick;Minutos;Kills;Valor (R$);Centavo de arredondamento;Pago');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).not.toMatch(/[^\r]\n/);
  });

  it('valor no formato brasileiro, sem ponto de milhar (o Excel em português lê como número)', () => {
    const csv = csvDoResultado([j(1, 'Lobos', 'Lua_', 100_000), j(2, 'Corvos', 'Tuca', 6_590, { recebeuCentavo: true }), j(5, 'Panteras', 'Mel', 0)]);
    expect(linhas(csv).slice(1, 4)).toEqual([
      '1;Lobos;Lua_;30;10;1000,00;não;',
      '2;Corvos;Tuca;30;10;65,90;sim;',
      '5;Panteras;Mel;30;10;0,00;não;',
    ]);
  });

  it('ordem: posição, depois o valor maior, depois o nick (sem diferenciar maiúsculas e acentos)', () => {
    const csv = csvDoResultado([
      j(2, 'Corvos', 'Zeca', 60_000),
      j(1, 'Lobos', 'pipoca', 100_000),
      j(2, 'Corvos', 'Tuca', 6_590),
      j(2, 'Corvos', 'Bia.gg', 53_410),
      j(1, 'Lobos', 'Lua_', 100_000),
      j(2, 'Corvos', 'Corvinho', 60_000),
      j(1, 'Lobos', 'Ágata', 100_000),
    ]);
    expect(linhas(csv).slice(1, -1).map((l) => l.split(';')[2])).toEqual(['Ágata', 'Lua_', 'pipoca', 'Corvinho', 'Zeca', 'Bia.gg', 'Tuca']);
  });

  it('times empatados na mesma posição ficam juntos e seguem o valor e o nick', () => {
    const csv = csvDoResultado([j(3, 'Tubarões', 'Gabs', 20_000), j(3, 'Falcões', 'Falk', 20_000)]);
    expect(linhas(csv).slice(1, -1)).toEqual(['3;Falcões;Falk;30;10;200,00;não;', '3;Tubarões;Gabs;30;10;200,00;não;']);
  });

  it('coluna "Pago" vazia no final, para a Maria marcar no Excel (o sistema não controla pagamento, D12)', () => {
    const csv = csvDoResultado([j(1, 'Lobos', 'Lua_', 100_000)]);
    expect(linhas(csv)[0].split(';').at(-1)).toBe('Pago');
    expect(linhas(csv)[1].split(';')).toHaveLength(8);
    expect(linhas(csv)[1].split(';').at(-1)).toBe('');
  });

  it('texto com ";", aspas ou quebra de linha vai entre aspas', () => {
    const csv = csvDoResultado([j(1, 'Time;A', 'o "Bala"', 100)]);
    expect(linhas(csv)[1]).toBe('1;"Time;A";"o ""Bala""";30;10;1,00;não;');
  });

  it('nick que começa com =, +, - ou @ não vira fórmula no Excel', () => {
    const csv = csvDoResultado([j(1, 'Lobos', '=SOMA(A1)', 100), j(1, 'Lobos', '-x-', 100), j(1, 'Lobos', '+1', 100), j(1, 'Lobos', '@nick', 100)]);
    expect(linhas(csv).slice(1, -1).map((l) => l.split(';')[2])).toEqual(["'+1", "'-x-", "'=SOMA(A1)", "'@nick"]);
  });

  it('nick que começa com tab ou \\r também ganha o apóstrofo (code review, item 10; lista da OWASP)', () => {
    const csv = csvDoResultado([j(1, 'Lobos', '\t=SOMA(A1)', 100), j(1, 'Lobos', '\r=SOMA(A1)', 100)]);
    expect(csv).toContain(";'\t=SOMA(A1);");
    // com \r a célula também vai entre aspas, como qualquer quebra de linha
    expect(csv).toContain(`;"'\r=SOMA(A1)";`);
  });
});

describe('nomeDoArquivoCsv', () => {
  it('com o nome do torneio, sem acentos nem espaços (o nome com acento vai à parte, no cabeçalho)', () => {
    expect(nomeDoArquivoCsv('Torneio de Setembro/2026')).toBe('resultado-torneio-de-setembro-2026.csv');
    expect(nomeDoArquivoCsv('Copa dos Falcões — final!')).toBe('resultado-copa-dos-falcoes-final.csv');
    expect(nomeDoArquivoCsv('   ')).toBe('resultado.csv');
  });
});
