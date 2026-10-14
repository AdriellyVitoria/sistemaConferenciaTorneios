import { describe, expect, it } from 'vitest';
import {
  envioDaPlanilha,
  formatarData,
  linhasDoErro,
  rotuloDaConferencia,
  rotuloDoModo,
  rotuloDoStatus,
} from '../src/dominio/torneio';

describe('envioDaPlanilha: o que a tela faz ao subir a planilha (D22)', () => {
  it('sem planilha ainda: envia direto', () => {
    expect(envioDaPlanilha({ status: 'criado', planilhaArquivo: null })).toBe('primeira');
  });

  it('já tem planilha: pede confirmação para substituir', () => {
    expect(envioDaPlanilha({ status: 'importado', planilhaArquivo: 'torneio-setembro.csv' })).toBe('substituir');
    expect(envioDaPlanilha({ status: 'conferindo', planilhaArquivo: 'torneio-setembro.csv' })).toBe('substituir');
    expect(envioDaPlanilha({ status: 'pronto', planilhaArquivo: 'torneio-setembro.csv' })).toBe('substituir');
  });

  it('depois do cálculo: travada', () => {
    expect(envioDaPlanilha({ status: 'calculado', planilhaArquivo: 'torneio-setembro.csv' })).toBe('travada');
  });
});

describe('linhasDoErro: onde procurar o erro no Excel', () => {
  it('erro de uma célula: a linha', () => {
    expect(linhasDoErro({ linha: 12, coluna: 'Minutos', mensagem: 'x' })).toBe('12');
  });

  it('erro de uma partida inteira (D23): todas as linhas', () => {
    expect(linhasDoErro({ linha: 7, linhas: [7, 8, 9], mensagem: 'x' })).toBe('7, 8, 9');
  });

  it('erro do arquivo todo: sem linha', () => {
    expect(linhasDoErro({ mensagem: 'A planilha não tem nenhuma partida.' })).toBe('—');
  });
});

describe('formatarData', () => {
  it('aaaa-mm-dd vira dd/mm/aaaa sem passar por Date (sem risco de fuso virar o dia)', () => {
    expect(formatarData('2026-09-19')).toBe('19/09/2026');
    expect(formatarData('2026-09-01')).toBe('01/09/2026');
  });
});

describe('rótulos para a Maria', () => {
  it('modo de divisão', () => {
    expect(rotuloDoModo('minutos')).toBe('Divisão por minutos jogados');
    expect(rotuloDoModo('kills')).toBe('Divisão por kills');
  });

  it('status do torneio', () => {
    expect(rotuloDoStatus('criado')).toBe('Aguardando a planilha');
    expect(rotuloDoStatus('importado')).toBe('Planilha importada');
    expect(rotuloDoStatus('conferindo')).toBe('Conferindo no site');
    expect(rotuloDoStatus('pronto')).toBe('Pronto para calcular');
    expect(rotuloDoStatus('calculado')).toBe('Calculado');
  });

  it('status da conferência de cada partida', () => {
    expect(rotuloDaConferencia('aguardando')).toBe('Aguardando o site');
    expect(rotuloDaConferencia('em_consulta')).toBe('Consultando o site');
    expect(rotuloDaConferencia('conferida')).toBe('Conferida');
    expect(rotuloDaConferencia('nao_encontrada')).toBe('Não encontrada no site');
    expect(rotuloDaConferencia('times_diferentes')).toBe('Times diferentes no site');
  });
});
