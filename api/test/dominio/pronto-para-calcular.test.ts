import { describe, expect, it } from 'vitest';
import { situacaoDoCalculo } from '../../src/dominio/pronto-para-calcular';

const TUDO_CERTO = {
  status: 'importado' as const,
  calculadoEm: null,
  quantidadeDePartidas: 15,
  aguardandoSite: 0,
  bloqueios: 0,
  semCiente: 0,
};

describe('situacaoDoCalculo: o torneio pode ser calculado? (D17)', () => {
  it('tudo conferido, sem bloqueio e com todos os Cientes: pode', () => {
    expect(situacaoDoCalculo(TUDO_CERTO)).toEqual({
      podeCalcular: true, calculado: false, calculadoEm: null, semPlanilha: false, aguardandoSite: 0, bloqueios: 0, semCiente: 0,
    });
  });

  it('cada motivo sozinho impede, e a contagem aparece', () => {
    expect(situacaoDoCalculo({ ...TUDO_CERTO, aguardandoSite: 2 })).toMatchObject({ podeCalcular: false, aguardandoSite: 2 });
    expect(situacaoDoCalculo({ ...TUDO_CERTO, bloqueios: 1 })).toMatchObject({ podeCalcular: false, bloqueios: 1 });
    expect(situacaoDoCalculo({ ...TUDO_CERTO, semCiente: 3 })).toMatchObject({ podeCalcular: false, semCiente: 3 });
  });

  it('vários motivos ao mesmo tempo: todas as contagens', () => {
    expect(situacaoDoCalculo({ ...TUDO_CERTO, aguardandoSite: 2, bloqueios: 1, semCiente: 3 })).toEqual({
      podeCalcular: false, calculado: false, calculadoEm: null, semPlanilha: false, aguardandoSite: 2, bloqueios: 1, semCiente: 3,
    });
  });

  it('sem planilha (nenhuma partida): não pode, mesmo com tudo zerado', () => {
    expect(situacaoDoCalculo({ ...TUDO_CERTO, status: 'criado', quantidadeDePartidas: 0 })).toMatchObject({ podeCalcular: false, semPlanilha: true });
  });

  it('já calculado: informa, e não pode calcular de novo', () => {
    const calculadoEm = new Date('2026-10-15T13:00:00.000Z');
    expect(situacaoDoCalculo({ ...TUDO_CERTO, status: 'calculado', calculadoEm })).toMatchObject({
      podeCalcular: false, calculado: true, calculadoEm,
    });
  });
});
