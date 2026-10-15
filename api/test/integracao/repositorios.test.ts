import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { lerPlanilha, type LinhaPlanilha } from '../../src/dominio/planilha';
import { inserirLinhas, listarLinhas } from '../../src/repositorios/linhas-planilha';
import { inserirPartidas, listarPartidas, type NovaPartida } from '../../src/repositorios/partidas';
import { buscarTorneio, criarTorneio, registrarImportacao, type NovoTorneio } from '../../src/repositorios/torneios';
import { conectarAoBancoDeTeste, esvaziarTabelas } from './banco-de-teste';

// A planilha original é só lida.
const RAIZ = path.resolve(__dirname, '../../..');

let bd: Knex;
/** O "agora" da importação nos testes (R2a): a próxima tentativa nasce com este relógio. */
const AGORA = new Date('2026-10-15T12:34:56.789Z');
beforeAll(() => { bd = conectarAoBancoDeTeste(); });
afterAll(() => bd.destroy());
beforeEach(() => esvaziarTabelas(bd));

const SETEMBRO: NovoTorneio = {
  nome: 'Torneio de setembro/2026',
  premioCentavos: 1_000_000,
  percentuais: [50, 30, 20],
  modoDivisao: 'minutos',
};

function linhasDeSetembro(): LinhaPlanilha[] {
  const resultado = lerPlanilha(readFileSync(path.join(RAIZ, 'torneio-setembro.csv')));
  if (!resultado.ok) throw new Error('planilha de setembro inválida');
  return resultado.linhas;
}

/** As partidas como a importação vai montá-las: uma por ID, com os dois times da planilha. */
function partidasDasLinhas(linhas: LinhaPlanilha[]): NovaPartida[] {
  const porId = new Map<string, NovaPartida>();
  for (const l of linhas) {
    const p = porId.get(l.idPartida) ?? { idPartida: l.idPartida, rodada: l.rodada, data: l.data, timeA: l.time, timeB: '' };
    if (l.time !== p.timeA && !p.timeB) p.timeB = l.time;
    porId.set(l.idPartida, p);
  }
  return [...porId.values()];
}

describe('repositório de torneios', () => {
  it('cria e busca: prêmio em centavos, percentuais e modo de divisão; nasce como "criado"', async () => {
    const id = await criarTorneio(bd, SETEMBRO);
    const torneio = await buscarTorneio(bd, id);
    expect(torneio).toMatchObject({
      id,
      ...SETEMBRO,
      status: 'criado',
      calculadoEm: null,
      planilhaArquivo: null,
      planilhaImportadaEm: null,
      planilhaConvertidaDeWindows1252: false,
    });
    expect(torneio!.criadoEm).toBeInstanceOf(Date);
  });

  it('o prêmio volta como número inteiro de centavos', async () => {
    const id = await criarTorneio(bd, { ...SETEMBRO, premioCentavos: 123_457 });
    const torneio = await buscarTorneio(bd, id);
    expect(torneio!.premioCentavos).toBe(123_457);
    expect(Number.isInteger(torneio!.premioCentavos)).toBe(true);
  });

  it('torneio que não existe: null', async () => {
    expect(await buscarTorneio(bd, 999_999)).toBeNull();
  });

  it('registra a importação: arquivo, horário, conversão de Windows-1252 e status "importado"', async () => {
    const id = await criarTorneio(bd, SETEMBRO);
    await registrarImportacao(bd, id, { arquivo: 'torneio-setembro.csv', convertidoDeWindows1252: true, agora: AGORA });
    const torneio = await buscarTorneio(bd, id);
    expect(torneio).toMatchObject({
      status: 'importado',
      planilhaArquivo: 'torneio-setembro.csv',
      planilhaConvertidaDeWindows1252: true,
    });
    // o horário da importação também vem do "agora" que ela recebe (R2a)
    expect(torneio!.planilhaImportadaEm).toEqual(new Date('2026-10-15T12:34:56.000Z'));
  });

  it('o banco recusa prêmio negativo e modo de divisão desconhecido', async () => {
    await expect(criarTorneio(bd, { ...SETEMBRO, premioCentavos: -1 })).rejects.toThrow();
    await expect(criarTorneio(bd, { ...SETEMBRO, modoDivisao: 'pontos' as never })).rejects.toThrow();
  });
});

describe('repositório de partidas (também a tabela de tarefas da conferência)', () => {
  it('insere as 15 partidas de setembro como "aguardando", prontas para a primeira consulta', async () => {
    const torneioId = await criarTorneio(bd, SETEMBRO);
    const ids = await inserirPartidas(bd, torneioId, partidasDasLinhas(linhasDeSetembro()), AGORA);
    expect(ids.size).toBe(15);

    const partidas = await listarPartidas(bd, torneioId);
    expect(partidas).toHaveLength(15);
    const p40923 = partidas.find((p) => p.idPartida === '#40923')!;
    expect(p40923).toMatchObject({
      id: ids.get('#40923'),
      torneioId,
      idPartidaPlanilha: '#40923',
      rodada: 5,
      data: '2026-09-19',
      timeA: 'Falcões',
      timeB: 'Panteras',
      vencedor: null,
      statusConferencia: 'aguardando',
      tentativas: 0,
      ultimaTentativaEm: null,
      emConsultaDesde: null,
      ultimoErro: null,
    });
    // a primeira tentativa já pode acontecer: nasce com o "agora" da importação (R2a, um relógio só
    // no código), em segundos inteiros, como o job grava. Sem depender do relógio do MySQL.
    expect(p40923.proximaTentativaEm).toEqual(new Date('2026-10-15T12:34:56.000Z'));
  });

  it('o mesmo ID não entra duas vezes no mesmo torneio, mas pode existir em outro', async () => {
    const a = await criarTorneio(bd, SETEMBRO);
    const b = await criarTorneio(bd, { ...SETEMBRO, nome: 'Outro' });
    const partida: NovaPartida = { idPartida: '#45659', rodada: 1, data: '2026-09-05', timeA: 'Lobos', timeB: 'Serpentes' };
    await inserirPartidas(bd, a, [partida], AGORA);
    await expect(inserirPartidas(bd, a, [partida], AGORA)).rejects.toThrow();
    await expect(inserirPartidas(bd, b, [partida], AGORA)).resolves.toBeDefined();
  });
});

describe('repositório de linhas da planilha', () => {
  it('guarda as 152 linhas de setembro como foram digitadas, ligadas à partida', async () => {
    const torneioId = await criarTorneio(bd, SETEMBRO);
    const linhas = linhasDeSetembro();
    const partidaIds = await inserirPartidas(bd, torneioId, partidasDasLinhas(linhas), AGORA);
    await inserirLinhas(bd, torneioId, linhas, partidaIds);

    const lidas = await listarLinhas(bd, torneioId);
    expect(lidas).toHaveLength(152);
    // volta exatamente o que o domínio leu, na ordem das linhas do Excel
    expect(lidas.map(({ partidaId: _p, ...linha }) => linha)).toEqual(linhas);
    expect(lidas.every((l) => l.partidaId === partidaIds.get(l.idPartida))).toBe(true);
  });

  it('preserva acentos, maiúsculas e a duplicata: o banco não junta nem descarta nada', async () => {
    const torneioId = await criarTorneio(bd, SETEMBRO);
    const linhas = linhasDeSetembro();
    await inserirLinhas(bd, torneioId, linhas, await inserirPartidas(bd, torneioId, partidasDasLinhas(linhas), AGORA));

    const nicks = (await listarLinhas(bd, torneioId)).map((l) => l.nick);
    expect(nicks).toContain('xxsniperxx');
    expect(nicks).toContain('xXSniperXx');
    expect(nicks).toContain('Tchê');
    expect(nicks.filter((n) => n === 'Pantera_X')).toHaveLength(6); // 5 partidas + a duplicata

    // a coluna diferencia maiúsculas e acentos: xxsniperxx não é xXSniperXx para o banco
    const iguais = await bd('linhas_planilha').where({ torneio_id: torneioId, nick: 'xxsniperxx' }).count({ n: '*' });
    expect(Number(iguais[0].n)).toBe(1);
    const semAcento = await bd('linhas_planilha').where({ torneio_id: torneioId, time: 'Falcoes' }).count({ n: '*' });
    expect(Number(semAcento[0].n)).toBe(0);
  });

  it('a partida #40923 zerada é guardada como veio: 0 minutos, 0 kills e Venceu? vazio', async () => {
    const torneioId = await criarTorneio(bd, SETEMBRO);
    const linhas = linhasDeSetembro();
    await inserirLinhas(bd, torneioId, linhas, await inserirPartidas(bd, torneioId, partidasDasLinhas(linhas), AGORA));
    const zerada = (await listarLinhas(bd, torneioId)).filter((l) => l.idPartida === '#40923');
    expect(zerada).toHaveLength(10);
    expect(zerada.every((l) => l.minutos === 0 && l.kills === 0 && l.venceu === null)).toBe(true);
  });

  it('apagar o torneio apaga as partidas e as linhas dele', async () => {
    const torneioId = await criarTorneio(bd, SETEMBRO);
    const linhas = linhasDeSetembro();
    await inserirLinhas(bd, torneioId, linhas, await inserirPartidas(bd, torneioId, partidasDasLinhas(linhas), AGORA));
    await bd('torneios').where({ id: torneioId }).del();
    expect(await listarPartidas(bd, torneioId)).toEqual([]);
    expect(await listarLinhas(bd, torneioId)).toEqual([]);
  });

  it('funciona dentro de uma transação: se algo falha, nada fica gravado', async () => {
    const torneioId = await criarTorneio(bd, SETEMBRO);
    const linhas = linhasDeSetembro();
    await expect(
      bd.transaction(async (trx) => {
        const ids = await inserirPartidas(trx, torneioId, partidasDasLinhas(linhas), AGORA);
        await inserirLinhas(trx, torneioId, linhas, ids);
        throw new Error('falha no meio da importação');
      }),
    ).rejects.toThrow('falha no meio');
    expect(await listarPartidas(bd, torneioId)).toEqual([]);
    expect(await listarLinhas(bd, torneioId)).toEqual([]);
  });
});
