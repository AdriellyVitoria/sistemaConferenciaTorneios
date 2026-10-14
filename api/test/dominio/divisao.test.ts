import { describe, expect, it } from 'vitest';
import { dividirMaiorResto, SomaDosPesosZero } from '../../src/dominio/divisao';

const valores = (resultado: { nome: string; valor: number }[]) =>
  Object.fromEntries(resultado.map((r) => [r.nome, r.valor]));
const comCentavo = (resultado: { nome: string; recebeuCentavo: boolean }[]) =>
  resultado.filter((r) => r.recebeuCentavo).map((r) => r.nome);
const soma = (resultado: { valor: number }[]) => resultado.reduce((a, r) => a + r.valor, 0);

describe('dividirMaiorResto', () => {
  it('R$ 5.000,00 em 3 partes iguais: os 2 centavos vão pela ordem alfabética', () => {
    const r = dividirMaiorResto(500_000, [
      { nome: 'Tubarões', peso: 1 },
      { nome: 'Corvos', peso: 1 },
      { nome: 'Falcões', peso: 1 },
    ]);
    expect(valores(r)).toEqual({ Corvos: 166_667, Falcões: 166_667, Tubarões: 166_666 });
    expect(comCentavo(r)).toEqual(['Corvos', 'Falcões']);
    expect(soma(r)).toBe(500_000);
  });

  it('ordem alfabética de dicionário: "Águias" vem antes de "Ursos" no empate da fração', () => {
    const r = dividirMaiorResto(100, [
      { nome: 'Ursos', peso: 1 },
      { nome: 'águias', peso: 1 },
      { nome: 'Zebras', peso: 1 },
    ]);
    expect(comCentavo(r)).toEqual(['águias']);
  });

  it('Corvos de setembro: Tuca recebe R$ 65,90 com o centavo, os de 173 minutos R$ 600,00', () => {
    const r = dividirMaiorResto(300_000, [
      { nome: 'Bia.gg', peso: 154 },
      { nome: 'Corvinho', peso: 173 },
      { nome: 'M4theus', peso: 173 },
      { nome: 'Nina.exe', peso: 173 },
      { nome: 'Tuca', peso: 19 },
      { nome: 'Zeca', peso: 173 },
    ]);
    expect(valores(r)).toEqual({
      'Bia.gg': 53_410, Corvinho: 60_000, M4theus: 60_000, 'Nina.exe': 60_000, Tuca: 6_590, Zeca: 60_000,
    });
    expect(comCentavo(r)).toEqual(['Tuca']);
  });

  it('Lobos por kills: R$ 1.260,62, 1.246,46, 949,01, 835,69 e 708,22', () => {
    const r = dividirMaiorResto(500_000, [
      { nome: 'xXSniperXx', peso: 89 },
      { nome: 'Lua_', peso: 88 },
      { nome: 'Pipoca', peso: 67 },
      { nome: 'R4mbo', peso: 59 },
      { nome: 'Dona.Tank', peso: 50 },
    ]);
    expect(r.map((p) => p.valor)).toEqual([126_062, 124_646, 94_901, 83_569, 70_822]);
    expect(soma(r)).toBe(500_000);
  });

  it('desempate pela ordem da lista: no empate da fração, ganha quem vem primeiro', () => {
    // entre posições do pódio: o centavo vai para a melhor colocada, não pela ordem alfabética
    const r = dividirMaiorResto(
      123_457,
      [{ nome: 'Zebras', peso: 50 }, { nome: 'Águias', peso: 50 }],
      { desempate: 'ordem_da_lista' },
    );
    expect(r).toEqual([
      { nome: 'Zebras', valor: 61_729, recebeuCentavo: true },
      { nome: 'Águias', valor: 61_728, recebeuCentavo: false },
    ]);
  });

  it('devolve os participantes na mesma ordem em que vieram', () => {
    const r = dividirMaiorResto(10, [{ nome: 'B', peso: 1 }, { nome: 'A', peso: 1 }, { nome: 'C', peso: 1 }]);
    expect(r.map((p) => p.nome)).toEqual(['B', 'A', 'C']);
  });

  it('valor zero: todos recebem zero e ninguém recebe centavo', () => {
    const r = dividirMaiorResto(0, [{ nome: 'A', peso: 3 }, { nome: 'B', peso: 7 }]);
    expect(r).toEqual([
      { nome: 'A', valor: 0, recebeuCentavo: false },
      { nome: 'B', valor: 0, recebeuCentavo: false },
    ]);
  });

  it('participante com peso zero recebe zero e nunca recebe centavo', () => {
    const r = dividirMaiorResto(100, [
      { nome: 'A', peso: 1 },
      { nome: 'B', peso: 0 },
      { nome: 'C', peso: 2 },
    ]);
    // A: 33,33… -> 33; C: 66,66… -> 66; sobra 1 centavo, para C (fração maior)
    expect(r).toEqual([
      { nome: 'A', valor: 33, recebeuCentavo: false },
      { nome: 'B', valor: 0, recebeuCentavo: false },
      { nome: 'C', valor: 67, recebeuCentavo: true },
    ]);
  });

  it('soma dos pesos zero: erro claro, sem decidir o que fazer', () => {
    const tentar = () => dividirMaiorResto(100, [{ nome: 'A', peso: 0 }, { nome: 'B', peso: 0 }]);
    expect(tentar).toThrow(SomaDosPesosZero);
    expect(tentar).toThrow('a soma dos pesos é zero');
    expect(() => dividirMaiorResto(100, [])).toThrow(SomaDosPesosZero);
  });

  it('recusa entrada que não é inteiro não negativo ou nome repetido', () => {
    expect(() => dividirMaiorResto(10.5, [{ nome: 'A', peso: 1 }])).toThrow('inteiro');
    expect(() => dividirMaiorResto(-1, [{ nome: 'A', peso: 1 }])).toThrow('inteiro');
    expect(() => dividirMaiorResto(10, [{ nome: 'A', peso: 1.5 }])).toThrow('inteiro');
    expect(() => dividirMaiorResto(10, [{ nome: 'A', peso: -1 }])).toThrow('inteiro');
    expect(() => dividirMaiorResto(10, [{ nome: 'A', peso: 1 }, { nome: 'A', peso: 2 }])).toThrow('repetido');
  });

  it('muitos valores aleatórios: a soma sempre fecha e ninguém fica a 1 centavo ou mais do valor exato', () => {
    // gerador com semente fixa: o teste dá sempre o mesmo resultado
    let semente = 20260914;
    const aleatorio = (max: number) => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return semente % (max + 1);
    };

    for (let rodada = 0; rodada < 2_000; rodada++) {
      const total = aleatorio(10_000_000);
      const participantes = Array.from({ length: 1 + aleatorio(12) }, (_, i) => ({
        nome: `jogador${i}`,
        peso: aleatorio(500),
      }));
      if (participantes.every((p) => p.peso === 0)) participantes[0].peso = 1;
      const somaPesos = participantes.reduce((a, p) => a + p.peso, 0);

      const r = dividirMaiorResto(total, participantes);
      expect(soma(r)).toBe(total);
      expect(r.filter((p) => p.recebeuCentavo).length).toBeLessThan(participantes.length);
      r.forEach((p, i) => {
        // |valor − exato| < 1 centavo, em inteiros: |valor × somaPesos − total × peso| < somaPesos
        expect(Math.abs(p.valor * somaPesos - total * participantes[i].peso)).toBeLessThan(somaPesos);
      });
    }
  });
});
