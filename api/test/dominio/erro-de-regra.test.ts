import { describe, expect, it } from 'vitest';
import type { ClassificacaoTime } from '../../src/dominio/classificacao';
import type { PartidaSite } from '../../src/dominio/comparacao';
import { dividirMaiorResto } from '../../src/dominio/divisao';
import { ErroDeRegra } from '../../src/dominio/erro-de-regra';
import { premiarTimes, type PremioTime } from '../../src/dominio/premio';
import { ratearEntreJogadores } from '../../src/dominio/rateio';

const time = (posicao: number, nome: string): ClassificacaoTime => ({ posicao, time: nome, vitorias: 0, killsTime: 0, criterio: null });
const premioDe = (nome: string, premioCentavos: number): PremioTime => ({
  posicao: 1, time: nome, vitorias: 0, killsTime: 0, criterio: null, premioCentavos, recebeuCentavo: false,
});

function erroLancado(fazer: () => unknown): unknown {
  try {
    fazer();
  } catch (erro) {
    return erro;
  }
  throw new Error('esperava um erro');
}

describe('ErroDeRegra: as frases para a Maria', () => {
  it('time premiado sem nenhum minuto nem kill no site (rateio)', () => {
    const partidas: PartidaSite[] = [{
      id: '#1', data: '2026-09-05', times: ['Lobos', 'Corvos'], vencedor: 'Lobos',
      jogadores: [{ nick: 'Lua_', time: 'Lobos', minutos: 0, kills: 0 }, { nick: 'Zeca', time: 'Corvos', minutos: 40, kills: 3 }],
    }];
    const erro = erroLancado(() => ratearEntreJogadores([premioDe('Lobos', 100_000)], partidas, 'minutos'));
    expect(erro).toBeInstanceOf(ErroDeRegra);
    expect((erro as Error).message).toBe('O time Lobos tem prêmio, mas nenhum minuto nem kill registrado no site: não há como dividir.');
  });

  it('percentuais que não somam 100 (prêmio por time)', () => {
    const erro = erroLancado(() => premiarTimes([time(1, 'A'), time(2, 'B')], 1_000_000, [50, 30]));
    expect(erro).toBeInstanceOf(ErroDeRegra);
    expect((erro as Error).message).toBe('Os percentuais precisam somar 100. Hoje somam 80.');
  });

  it('nenhum time para receber o prêmio', () => {
    const erro = erroLancado(() => premiarTimes([], 1_000_000, [100]));
    expect(erro).toBeInstanceOf(ErroDeRegra);
    expect((erro as Error).message).toBe('Não há times para receber o prêmio.');
  });

  it('proteção de programação continua sendo erro comum (vira 500, porque é bug)', () => {
    const erro = erroLancado(() => dividirMaiorResto(10.5, [{ nome: 'A', peso: 1 }]));
    expect(erro).toBeInstanceOf(Error);
    expect(erro).not.toBeInstanceOf(ErroDeRegra);
  });
});
