import { describe, expect, it } from 'vitest';
import { nomeDoArquivoBaixado } from '../src/utilitarios/arquivo';

describe('nomeDoArquivoBaixado', () => {
  it('prefere o filename*, com os acentos (RFC 6266)', () => {
    const disposicao = `attachment; filename="resultado-torneio-de-setembro-2026.csv"; filename*=UTF-8''${encodeURIComponent('resultado-Torneio de Março-2026.csv')}`;
    expect(nomeDoArquivoBaixado(disposicao, 'resultado.csv')).toBe('resultado-Torneio de Março-2026.csv');
  });

  it('sem filename*: o filename', () => {
    expect(nomeDoArquivoBaixado('attachment; filename="resultado-setembro.csv"', 'resultado.csv')).toBe('resultado-setembro.csv');
  });

  it('filename* mal escrito: cai no filename', () => {
    expect(nomeDoArquivoBaixado(`attachment; filename="resultado-setembro.csv"; filename*=UTF-8''%E9%`, 'resultado.csv')).toBe('resultado-setembro.csv');
  });

  it('sem cabeçalho ou sem nome: o padrão', () => {
    expect(nomeDoArquivoBaixado(null, 'resultado.csv')).toBe('resultado.csv');
    expect(nomeDoArquivoBaixado('attachment', 'resultado.csv')).toBe('resultado.csv');
  });

  it('nome com barra ou ".." vira o padrão: o arquivo não sai da pasta de downloads', () => {
    expect(nomeDoArquivoBaixado('attachment; filename="../../x.csv"', 'resultado.csv')).toBe('resultado.csv');
    expect(nomeDoArquivoBaixado(`attachment; filename*=UTF-8''${encodeURIComponent('a/b.csv')}`, 'resultado.csv')).toBe('resultado.csv');
  });
});
