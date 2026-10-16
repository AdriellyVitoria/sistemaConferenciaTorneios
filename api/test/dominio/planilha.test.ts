import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lerPlanilha, type ErroLeitura, type LinhaPlanilha } from '../../src/dominio/planilha';

const RAIZ = path.resolve(__dirname, '../../..');
const PLANILHAS = path.join(RAIZ, 'testes/planilhas');
const lerArquivo = (caminho: string) => readFileSync(caminho);

const CABECALHO = 'Data;Rodada;ID Partida;Partida;Time;Nick;Minutos;Kills;Venceu?';
const LINHA_OK = '05/09/2026;1;#45659;Lobos x Serpentes;Lobos;Lua_;43;14;sim';

function arquivo(linhas: string[], { bom = true, quebra = '\r\n' } = {}): Uint8Array {
  const texto = linhas.join(quebra) + quebra;
  const bytes = Buffer.from(texto, 'utf8');
  return bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]) : bytes;
}

function linhasOk(conteudo: Uint8Array): LinhaPlanilha[] {
  const resultado = lerPlanilha(conteudo);
  if (!resultado.ok) throw new Error(`esperava leitura sem erro: ${JSON.stringify(resultado.erros)}`);
  return resultado.linhas;
}

function erros(conteudo: Uint8Array): ErroLeitura[] {
  const resultado = lerPlanilha(conteudo);
  if (resultado.ok) throw new Error('esperava erro de leitura');
  return resultado.erros;
}

describe('lerPlanilha — arquivos reais', () => {
  it('lê a planilha original de setembro: 152 linhas, sem erro', () => {
    const resultado = lerPlanilha(lerArquivo(path.join(RAIZ, 'torneio-setembro.csv')));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.separador).toBe(';');
    expect(resultado.convertidoDeWindows1252).toBe(false);
    expect(resultado.linhas).toHaveLength(152);

    expect(resultado.linhas[0]).toEqual({
      numeroLinha: 2,
      data: '2026-09-05',
      rodada: 1,
      idPartida: '#45659',
      partida: 'Lobos x Serpentes',
      time: 'Lobos',
      nick: 'xXSniperXx',
      minutos: 43,
      kills: 25,
      venceu: true,
    });
    expect(resultado.linhas.at(-1)?.numeroLinha).toBe(153);
  });

  it('aceita a #40923 zerada e com Venceu? vazio: quem resolve é o site', () => {
    const linhas = linhasOk(lerArquivo(path.join(RAIZ, 'torneio-setembro.csv')));
    const partida = linhas.filter((l) => l.idPartida === '#40923');
    expect(partida).toHaveLength(10);
    for (const l of partida) {
      expect(l).toMatchObject({ minutos: 0, kills: 0, venceu: null });
    }
  });

  it('mantém acentos e as linhas como foram digitadas (duplicata e nick são da parte 2)', () => {
    const linhas = linhasOk(lerArquivo(path.join(RAIZ, 'torneio-setembro.csv')));
    expect(linhas.some((l) => l.time === 'Falcões' && l.nick === 'Dudu.pro')).toBe(true);
    expect(linhas.some((l) => l.nick === 'Víbora')).toBe(true);
    expect(linhas.filter((l) => l.idPartida === '#46065' && l.nick === 'Pantera_X')).toHaveLength(2);
    expect(linhas.some((l) => l.nick === 'xxsniperxx')).toBe(true);
    expect(linhas.find((l) => l.nick === 'Bia.gg' && l.idPartida === '#44040')?.venceu).toBe(true);
    expect(linhas.find((l) => l.nick === 'Sombra' && l.idPartida === '#44040')?.venceu).toBe(false);
  });

  it('recusa a 06a dizendo que falta a coluna Kills', () => {
    const lista = erros(lerArquivo(path.join(PLANILHAS, '06a-coluna-faltando.csv')));
    expect(lista).toHaveLength(1);
    expect(lista[0].coluna).toBe('Kills');
    expect(lista[0].linha).toBe(1);
    expect(lista[0].mensagem).toContain('Kills');
  });

  it('lê a 06b (vírgula) com o mesmo resultado da versão com ponto e vírgula', () => {
    const bytes = lerArquivo(path.join(PLANILHAS, '06b-separador-virgula.csv'));
    const comPontoEVirgula = Buffer.from(bytes.toString('utf8').replaceAll(',', ';'), 'utf8');

    const virgula = lerPlanilha(bytes);
    const pontoEVirgula = lerPlanilha(comPontoEVirgula);
    expect(virgula.ok && virgula.separador).toBe(',');
    expect(pontoEVirgula.ok && pontoEVirgula.separador).toBe(';');
    expect(linhasOk(bytes)).toHaveLength(150);
    expect(linhasOk(bytes)).toEqual(linhasOk(comPontoEVirgula));
  });

  it('lê todas as outras planilhas de teste sem erro', () => {
    const esperado: Record<string, number> = {
      '05-oito-times.csv': 280,
      'torneio-outubro.csv': 151,
      'torneio-novembro.csv': 151,
      'torneio-setembro.csv': 152,
    };
    for (const nome of readdirSync(PLANILHAS).filter((n) => n.endsWith('.csv') && !n.startsWith('06a'))) {
      expect(linhasOk(lerArquivo(path.join(PLANILHAS, nome))), nome).toHaveLength(esperado[nome] ?? 150);
    }
  });
});

describe('lerPlanilha — formato do arquivo', () => {
  it('lê com e sem BOM, com CRLF e com LF, sempre com o mesmo resultado', () => {
    const variantes = [
      arquivo([CABECALHO, LINHA_OK], { bom: true, quebra: '\r\n' }),
      arquivo([CABECALHO, LINHA_OK], { bom: false, quebra: '\r\n' }),
      arquivo([CABECALHO, LINHA_OK], { bom: true, quebra: '\n' }),
      arquivo([CABECALHO, LINHA_OK], { bom: false, quebra: '\n' }),
    ];
    const primeira = linhasOk(variantes[0]);
    expect(primeira).toHaveLength(1);
    expect(primeira[0].nick).toBe('Lua_');
    for (const v of variantes) expect(linhasOk(v)).toEqual(primeira);
  });

  it('lê arquivo sem quebra de linha no final', () => {
    const bytes = Buffer.from(`${CABECALHO}\r\n${LINHA_OK}`, 'utf8');
    expect(linhasOk(bytes)).toHaveLength(1);
  });

  it('converte de Windows-1252 quando o arquivo não é UTF-8 e avisa que converteu', () => {
    const texto = `${CABECALHO}\r\n19/09/2026;5;#40923;Falcões x Panteras;Falcões;Tchê;38;10;não\r\n`;
    const resultado = lerPlanilha(Buffer.from(texto, 'latin1'));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.convertidoDeWindows1252).toBe(true);
    expect(resultado.linhas[0]).toMatchObject({ time: 'Falcões', nick: 'Tchê', venceu: false });
  });

  it('respeita aspas do padrão CSV (nick com vírgula num arquivo com vírgula)', () => {
    const bytes = arquivo([
      'Data,Rodada,ID Partida,Partida,Time,Nick,Minutos,Kills,Venceu?',
      '05/09/2026,1,#45659,Lobos x Serpentes,Lobos,"Lua, a Rainha",43,14,sim',
    ]);
    expect(linhasOk(bytes)[0].nick).toBe('Lua, a Rainha');
  });

  it('ignora linhas totalmente vazias ou só com separadores, sem mudar a numeração', () => {
    const linhas = linhasOk(arquivo([CABECALHO, LINHA_OK, ';;;;;;;;', '', LINHA_OK]));
    expect(linhas.map((l) => l.numeroLinha)).toEqual([2, 5]);
  });

  it('recusa arquivo vazio ou só com cabeçalho', () => {
    expect(erros(Buffer.from('', 'utf8'))[0].mensagem).toBe('A planilha não tem nenhuma partida.');
    expect(erros(arquivo([CABECALHO]))[0].mensagem).toBe('A planilha não tem nenhuma partida.');
  });
});

describe('lerPlanilha — cabeçalho', () => {
  it('aceita maiúsculas, acentos, espaços e "Venceu" sem interrogação', () => {
    const bytes = arquivo([' data ;RODADA;id partida;Partida;TIME;nick; Minutos ;KILLS;venceu', LINHA_OK]);
    expect(linhasOk(bytes)[0]).toMatchObject({ nick: 'Lua_', kills: 14, venceu: true });
  });

  it('aceita colunas em outra ordem e ignora colunas a mais', () => {
    const bytes = arquivo([
      'Nick;Time;Observações;Venceu?;Kills;Minutos;Partida;ID Partida;Rodada;Data',
      'Lua_;Lobos;jogou bem;sim;14;43;Lobos x Serpentes;#45659;1;05/09/2026',
    ]);
    expect(linhasOk(bytes)).toEqual(linhasOk(arquivo([CABECALHO, LINHA_OK])));
  });

  it('lista todas as colunas que faltam', () => {
    const lista = erros(arquivo(['Data;Rodada;ID Partida;Partida;Time;Nick', LINHA_OK]));
    expect(lista.map((e) => e.coluna)).toEqual(['Minutos', 'Kills', 'Venceu?']);
    expect(lista[0].mensagem).toBe('Falta a coluna "Minutos" na planilha.');
  });

  it('recusa coluna repetida', () => {
    const lista = erros(arquivo([`${CABECALHO};Nick`, `${LINHA_OK};Lua_`]));
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ linha: 1, coluna: 'Nick' });
    expect(lista[0].mensagem).toBe('A coluna "Nick" aparece mais de uma vez.');
  });
});

describe('lerPlanilha — valores das linhas', () => {
  const comValor = (coluna: number, valor: string) => {
    const campos = LINHA_OK.split(';');
    campos[coluna] = valor;
    return campos.join(';');
  };
  const DATA = 0, RODADA = 1, ID = 2, TIME = 4, NICK = 5, MINUTOS = 6, KILLS = 7, VENCEU = 8;

  it('converte a data dd/mm/aaaa, com ou sem zero à esquerda', () => {
    expect(linhasOk(arquivo([CABECALHO, comValor(DATA, '05/09/2026')]))[0].data).toBe('2026-09-05');
    expect(linhasOk(arquivo([CABECALHO, comValor(DATA, '5/9/2026')]))[0].data).toBe('2026-09-05');
  });

  it('recusa data inválida ou impossível', () => {
    for (const data of ['31/02/2026', '2026-09-05', '05/13/2026', '05/09/26', 'ontem', '']) {
      const lista = erros(arquivo([CABECALHO, comValor(DATA, data)]));
      expect(lista, data).toHaveLength(1);
      expect(lista[0]).toMatchObject({ linha: 2, coluna: 'Data', valor: data });
    }
  });

  it('recusa minutos com texto, decimal, negativo ou vazio', () => {
    for (const minutos of ['quarenta', '42,0', '42.5', '-3', '']) {
      const lista = erros(arquivo([CABECALHO, comValor(MINUTOS, minutos)]));
      expect(lista, minutos).toHaveLength(1);
      expect(lista[0]).toMatchObject({ linha: 2, coluna: 'Minutos', valor: minutos });
    }
  });

  it('aceita minutos e kills iguais a zero', () => {
    const linha = linhasOk(arquivo([CABECALHO, comValor(KILLS, '0')]))[0];
    expect(linha.kills).toBe(0);
  });

  it('lê "sim", "não", "nao" e vazio, ignorando maiúsculas e espaços', () => {
    const casos: [string, boolean | null][] = [
      ['sim', true], ['SIM', true], [' Sim ', true],
      ['não', false], ['NÃO', false], ['nao', false], ['Nao', false],
      ['', null], ['  ', null],
    ];
    for (const [valor, esperado] of casos) {
      expect(linhasOk(arquivo([CABECALHO, comValor(VENCEU, valor)]))[0].venceu, valor).toBe(esperado);
    }
  });

  it('recusa Venceu? com valor estranho', () => {
    for (const valor of ['s', 'n', 'x', 'talvez', 'yes']) {
      const lista = erros(arquivo([CABECALHO, comValor(VENCEU, valor)]));
      expect(lista, valor).toHaveLength(1);
      expect(lista[0]).toMatchObject({ linha: 2, coluna: 'Venceu?', valor });
      expect(lista[0].mensagem).toContain('sim');
    }
  });

  it('acrescenta o # no ID da partida e recusa ID com letras', () => {
    expect(linhasOk(arquivo([CABECALHO, comValor(ID, '45659')]))[0].idPartida).toBe('#45659');
    const lista = erros(arquivo([CABECALHO, comValor(ID, '#4S659')]));
    expect(lista[0]).toMatchObject({ linha: 2, coluna: 'ID Partida' });
  });

  it('recusa rodada que não é inteiro maior que zero', () => {
    for (const rodada of ['0', '-1', 'um', '1.5']) {
      expect(erros(arquivo([CABECALHO, comValor(RODADA, rodada)]))[0], rodada).toMatchObject({ coluna: 'Rodada' });
    }
  });

  it('recusa Time ou Nick vazios e tira espaços em volta dos valores', () => {
    expect(erros(arquivo([CABECALHO, comValor(TIME, ' ')]))[0]).toMatchObject({ coluna: 'Time' });
    expect(erros(arquivo([CABECALHO, comValor(NICK, '')]))[0]).toMatchObject({ coluna: 'Nick' });
    expect(linhasOk(arquivo([CABECALHO, comValor(NICK, '  Lua_  ')]))[0].nick).toBe('Lua_');
  });

  it('junta todos os erros de todas as linhas, com o número da linha do Excel', () => {
    const lista = erros(arquivo([
      CABECALHO,
      LINHA_OK,
      comValor(MINUTOS, 'quarenta'),
      LINHA_OK,
      '31/02/2026;1;#45659;Lobos x Serpentes;Lobos;Pipoca;43;dez;talvez',
    ]));
    expect(lista.map((e) => [e.linha, e.coluna])).toEqual([
      [3, 'Minutos'],
      [5, 'Data'],
      [5, 'Kills'],
      [5, 'Venceu?'],
    ]);
  });

  it('escreve mensagens em português simples, com o valor que veio', () => {
    const [erro] = erros(arquivo([CABECALHO, comValor(MINUTOS, 'quarenta')]));
    expect(erro.mensagem).toBe('Os minutos precisam ser um número inteiro, como 43. Veio "quarenta".');
  });
});
