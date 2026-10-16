import { describe, expect, it } from 'vitest';
import { lerConfig as lerConfigCompleta } from '../src/config';

/** A senha é obrigatória (R3): os testes da consulta ao site partem de um ambiente que a tem. */
const lerConfig = (ambiente: Record<string, string | undefined>) => lerConfigCompleta({ ADMIN_SENHA: 'senha-de-teste', ...ambiente });

describe('senha da organizadora (R3)', () => {
  it('sem ADMIN_SENHA, a API não sobe, e a frase diz o que fazer', () => {
    expect(() => lerConfigCompleta({})).toThrow('ADMIN_SENHA não foi definida');
  });

  it('vazia ou com menos de 8 caracteres: recusada', () => {
    expect(() => lerConfig({ ADMIN_SENHA: '' })).toThrow('ADMIN_SENHA precisa ter pelo menos 8 caracteres');
    expect(() => lerConfig({ ADMIN_SENHA: '1234567' })).toThrow('ADMIN_SENHA precisa ter pelo menos 8 caracteres');
  });

  it('com acento ou espaço nas pontas: recusada (o navegador não manda acento num cabeçalho)', () => {
    expect(() => lerConfig({ ADMIN_SENHA: 'organizadoraçã' })).toThrow('ADMIN_SENHA só pode ter letras sem acento, números e símbolos');
    expect(() => lerConfig({ ADMIN_SENHA: ' organizadora' })).toThrow('ADMIN_SENHA não pode começar nem terminar com espaço');
  });

  it('8 caracteres ou mais, com símbolos e espaço no meio: aceita, exatamente como veio', () => {
    expect(lerConfig({ ADMIN_SENHA: '12345678' }).ADMIN_SENHA).toBe('12345678');
    expect(lerConfig({ ADMIN_SENHA: 'Maria Clara #2026!' }).ADMIN_SENHA).toBe('Maria Clara #2026!');
  });
});

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
