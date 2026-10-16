import { describe, expect, it } from 'vitest';
import { lerPlanilha, validarIdPartida, type ErroLeitura } from '../../src/dominio/planilha';

/**
 * Code review, itens 2, 12 e 13: nenhum valor da planilha pode passar da coluna do banco (o MySQL,
 * em modo estrito, recusaria o INSERT e a Maria veria um erro 500 sem a linha do Excel). Os limites
 * estão escritos aqui por extenso, de propósito: mudar a constante do código sem querer faz o teste falhar.
 */

const CABECALHO = 'Data;Rodada;ID Partida;Partida;Time;Nick;Minutos;Kills;Venceu?';
const CAMPOS_OK = ['05/09/2026', '1', '#45659', 'Lobos x Serpentes', 'Lobos', 'Lua_', '43', '14', 'sim'];
const DATA = 0, RODADA = 1, ID = 2, PARTIDA = 3, TIME = 4, NICK = 5, MINUTOS = 6, KILLS = 7;

/** Uma planilha de uma linha (a linha 2 do Excel), com uma célula trocada. */
function planilhaCom(coluna: number, valor: string): Uint8Array {
  const campos = [...CAMPOS_OK];
  campos[coluna] = valor;
  return Buffer.from(`${CABECALHO}\r\n${campos.join(';')}\r\n`, 'utf8');
}

function erroUnico(conteudo: Uint8Array): ErroLeitura {
  const resultado = lerPlanilha(conteudo);
  if (resultado.ok) throw new Error('esperava erro de leitura');
  expect(resultado.erros).toHaveLength(1);
  return resultado.erros[0];
}

const aceita = (conteudo: Uint8Array) => expect(lerPlanilha(conteudo).ok).toBe(true);

describe('limites de texto (o tamanho das colunas do banco)', () => {
  it('nick até 80 caracteres; com 81, erro na linha do Excel', () => {
    aceita(planilhaCom(NICK, 'n'.repeat(80)));
    expect(erroUnico(planilhaCom(NICK, 'n'.repeat(81)))).toEqual({
      linha: 2, coluna: 'Nick', valor: 'n'.repeat(81),
      mensagem: 'O nick pode ter até 80 caracteres. Este tem 81.',
    });
  });

  it('conta caracteres como o MySQL: um emoji é um caractere só', () => {
    // 79 letras + 1 emoji = 80 caracteres (o .length do JavaScript diria 81)
    aceita(planilhaCom(NICK, `${'n'.repeat(79)}🎮`));
    expect(erroUnico(planilhaCom(NICK, `${'n'.repeat(80)}🎮`)).mensagem).toBe('O nick pode ter até 80 caracteres. Este tem 81.');
  });

  it('nome do time até 80 caracteres', () => {
    aceita(planilhaCom(TIME, 't'.repeat(80)));
    expect(erroUnico(planilhaCom(TIME, 't'.repeat(81)))).toMatchObject({
      linha: 2, coluna: 'Time', mensagem: 'O nome do time pode ter até 80 caracteres. Este tem 81.',
    });
  });

  it('coluna Partida até 200 caracteres', () => {
    aceita(planilhaCom(PARTIDA, 'p'.repeat(200)));
    expect(erroUnico(planilhaCom(PARTIDA, 'p'.repeat(201)))).toMatchObject({
      linha: 2, coluna: 'Partida', mensagem: 'A coluna Partida pode ter até 200 caracteres. Esta tem 201.',
    });
  });
});

describe('limite do ID da partida (19 números)', () => {
  it('na planilha: 19 números passam; 20, erro', () => {
    aceita(planilhaCom(ID, `#${'1'.repeat(19)}`));
    expect(erroUnico(planilhaCom(ID, `#${'1'.repeat(20)}`))).toMatchObject({
      linha: 2, coluna: 'ID Partida', mensagem: `O ID da partida pode ter até 19 números. Veio "#${'1'.repeat(20)}", com 20.`,
    });
  });

  it('na correção do ID: a mesma regra e a mesma frase', () => {
    expect(validarIdPartida(`#${'9'.repeat(19)}`)).toEqual({ ok: true, idPartida: `#${'9'.repeat(19)}` });
    expect(validarIdPartida('1'.repeat(30))).toEqual({
      ok: false, mensagem: `O ID da partida pode ter até 19 números. Veio "${'1'.repeat(30)}", com 30.`,
    });
  });
});

describe('limites de minutos e kills (0 a 100.000)', () => {
  it('minutos: 100.000 passa; 100.001, erro', () => {
    aceita(planilhaCom(MINUTOS, '100000'));
    expect(erroUnico(planilhaCom(MINUTOS, '100001'))).toMatchObject({
      linha: 2, coluna: 'Minutos', mensagem: 'Os minutos precisam estar entre 0 e 100.000. Veio "100001".',
    });
  });

  it('kills: 100.000 passa; 100.001 e 5.000.000.000, erro', () => {
    aceita(planilhaCom(KILLS, '100000'));
    expect(erroUnico(planilhaCom(KILLS, '100001')).mensagem).toBe('As kills precisam estar entre 0 e 100.000. Veio "100001".');
    expect(erroUnico(planilhaCom(KILLS, '5000000000')).mensagem).toBe('As kills precisam estar entre 0 e 100.000. Veio "5000000000".');
  });

  it('número com dígitos demais para o JavaScript: a mesma frase de limite, e não "precisa ser inteiro"', () => {
    expect(erroUnico(planilhaCom(MINUTOS, '99999999999999999999')).mensagem).toBe(
      'Os minutos precisam estar entre 0 e 100.000. Veio "99999999999999999999".',
    );
  });
});

describe('limite técnico da rodada (a capacidade da coluna)', () => {
  it('4.294.967.295 passa; 4.294.967.296, erro, em vez de 500 no banco', () => {
    aceita(planilhaCom(RODADA, '4294967295'));
    expect(erroUnico(planilhaCom(RODADA, '4294967296'))).toMatchObject({
      linha: 2, coluna: 'Rodada', mensagem: 'A rodada é grande demais. Veio "4294967296".',
    });
  });
});

describe('ano da data (2000 a 2100)', () => {
  it('aceita 2000 e 2100', () => {
    aceita(planilhaCom(DATA, '01/01/2000'));
    aceita(planilhaCom(DATA, '31/12/2100'));
  });

  it('recusa 1999, 2101, 01/01/0001 e 01/09/0226 (um "2" no lugar errado)', () => {
    for (const data of ['31/12/1999', '01/01/2101', '01/01/0001', '01/09/0226']) {
      expect(erroUnico(planilhaCom(DATA, data)), data).toEqual({
        linha: 2, coluna: 'Data', valor: data,
        mensagem: `O ano da data precisa estar entre 2000 e 2100. Veio "${data}".`,
      });
    }
  });
});

describe('arquivo do Excel (.xlsx) em vez de CSV', () => {
  it('bytes PK\\x03\\x04 no início: uma frase só, no lugar dos nove "Falta a coluna"', () => {
    const xlsx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml qualquer coisa')]);
    const resultado = lerPlanilha(xlsx);
    expect(resultado).toEqual({
      ok: false,
      convertidoDeWindows1252: false,
      erros: [{ mensagem: 'Este arquivo é do Excel (.xlsx). No Excel, use Salvar como → CSV UTF-8 (separado por vírgulas).' }],
    });
  });

  it('um CSV que começa com as letras "PK" continua sendo lido como CSV', () => {
    const resultado = lerPlanilha(Buffer.from('PK;Rodada\r\n1;2\r\n', 'utf8'));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erros.some((e) => e.mensagem.startsWith('Falta a coluna'))).toBe(true);
  });
});
