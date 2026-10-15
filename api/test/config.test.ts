import { describe, expect, it } from 'vitest';
import { lerConfig } from '../src/config';

describe('configuração da consulta ao site oficial', () => {
  it('padrões: site local, tempo limite de 15 s (acima dos 10 s de demora máxima) e intervalos 1, 2, 5 e 10 min', () => {
    expect(lerConfig({})).toMatchObject({
      SITE_URL: 'http://localhost:4000',
      SITE_TEMPO_LIMITE_MS: 15_000,
      SITE_DEMORA_MAX_MS: 10_000,
      CONFERENCIA_INTERVALOS_MS: [60_000, 120_000, 300_000, 600_000],
    });
  });

  it('a demonstração encurta tudo: demora máxima de 800 ms, tempo limite de 2 s, intervalos de segundos', () => {
    expect(
      lerConfig({ SITE_DEMORA_MAX_MS: '800', SITE_TEMPO_LIMITE_MS: '2000', CONFERENCIA_INTERVALOS_MS: '2000, 4000,8000' }),
    ).toMatchObject({ SITE_TEMPO_LIMITE_MS: 2_000, CONFERENCIA_INTERVALOS_MS: [2_000, 4_000, 8_000] });
  });

  it('recusa tempo limite que não passa da demora máxima do site: toda consulta lenta viraria falha', () => {
    expect(() => lerConfig({ SITE_TEMPO_LIMITE_MS: '10000' })).toThrow(
      'SITE_TEMPO_LIMITE_MS (10000) precisa ser maior que a demora máxima do site, SITE_DEMORA_MAX_MS (10000)',
    );
    expect(() => lerConfig({ SITE_DEMORA_MAX_MS: '800', SITE_TEMPO_LIMITE_MS: '500' })).toThrow('precisa ser maior');
  });

  it('job: acorda a cada 5 s, consulta 3 partidas por vez e recupera a partida presa há mais de 2 min', () => {
    expect(lerConfig({})).toMatchObject({
      CONFERENCIA_ACORDAR_A_CADA_MS: 5_000,
      CONFERENCIA_LOTE: 3,
      CONFERENCIA_PRESA_APOS_MS: 120_000,
    });
  });

  it('recusa tempo de "presa" que não passa do tempo limite: uma consulta lenta, mas viva, seria tomada', () => {
    expect(() => lerConfig({ CONFERENCIA_PRESA_APOS_MS: '15000' })).toThrow(
      'CONFERENCIA_PRESA_APOS_MS (15000) precisa ser maior que o tempo limite da consulta, SITE_TEMPO_LIMITE_MS (15000)',
    );
  });

  it.each([[''], ['60000,,120000'], ['60000,abc'], ['0'], ['-1000'], ['1.5']])(
    'recusa intervalos inválidos: "%s"',
    (texto) => {
      expect(() => lerConfig({ CONFERENCIA_INTERVALOS_MS: texto })).toThrow('CONFERENCIA_INTERVALOS_MS');
    },
  );
});
