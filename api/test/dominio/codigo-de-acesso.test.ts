import { describe, expect, it } from 'vitest';
import { FORMATO_DO_CODIGO, gerarCodigoDeAcesso } from '../../src/dominio/codigo-de-acesso';

describe('gerarCodigoDeAcesso (D11)', () => {
  it('32 caracteres seguros para URL: letras, números, "-" e "_"', () => {
    for (let i = 0; i < 200; i++) {
      const codigo = gerarCodigoDeAcesso();
      expect(codigo).toHaveLength(32);
      expect(codigo).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(encodeURIComponent(codigo)).toBe(codigo);
    }
  });

  it('aleatório: 10 mil códigos, nenhum repetido', () => {
    const codigos = new Set(Array.from({ length: 10_000 }, () => gerarCodigoDeAcesso()));
    expect(codigos.size).toBe(10_000);
  });

  it('vem de bytes aleatórios do sistema (24 bytes = 192 bits): mesmos bytes, mesmo código', () => {
    const bytes = Buffer.alloc(24, 0xff);
    expect(gerarCodigoDeAcesso(() => bytes)).toBe('_'.repeat(32));
  });

  it('FORMATO_DO_CODIGO aceita só o formato gerado', () => {
    expect(FORMATO_DO_CODIGO.test(gerarCodigoDeAcesso())).toBe(true);
    for (const errado of ['', 'abc', 'a'.repeat(31), 'a'.repeat(33), `${'a'.repeat(31)}=`, `${'a'.repeat(31)}/`, `${'a'.repeat(31)}+`]) {
      expect(FORMATO_DO_CODIGO.test(errado)).toBe(false);
    }
  });
});
