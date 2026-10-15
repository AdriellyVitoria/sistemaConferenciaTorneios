import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarSondagem } from '../src/utilitarios/sondagem';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('criarSondagem: consultar a API a cada 5 s enquanto houver o que esperar', () => {
  it('consulta a cada 5 s enquanto a atualização disser que precisa continuar', async () => {
    const atualizar = vi.fn(async () => true);
    const sondagem = criarSondagem({ atualizar, intervaloMs: 5_000 });

    sondagem.garantirAtiva();
    expect(atualizar).not.toHaveBeenCalled(); // a tela já tem os dados: a primeira consulta é daqui a 5 s
    await vi.advanceTimersByTimeAsync(5_000);
    expect(atualizar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(atualizar).toHaveBeenCalledTimes(4);
    sondagem.parar();
  });

  it('para sozinha quando não há mais o que esperar', async () => {
    const respostas = [true, true, false];
    const atualizar = vi.fn(async () => respostas.shift() ?? false);
    const sondagem = criarSondagem({ atualizar, intervaloMs: 5_000 });

    sondagem.garantirAtiva();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(atualizar).toHaveBeenCalledTimes(3);
    expect(sondagem.ativa()).toBe(false);
    expect(vi.getTimerCount()).toBe(0); // nenhum intervalo esquecido
  });

  it('parar (ao sair da página) cancela a próxima consulta', async () => {
    const atualizar = vi.fn(async () => true);
    const sondagem = criarSondagem({ atualizar, intervaloMs: 5_000 });
    sondagem.garantirAtiva();
    await vi.advanceTimersByTimeAsync(5_000);

    sondagem.parar();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(atualizar).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('parar durante uma consulta em andamento: ela termina e não agenda outra', async () => {
    let terminar!: (continuar: boolean) => void;
    const atualizar = vi.fn(() => new Promise<boolean>((pronto) => { terminar = pronto; }));
    const sondagem = criarSondagem({ atualizar, intervaloMs: 5_000 });
    sondagem.garantirAtiva();
    await vi.advanceTimersByTimeAsync(5_000); // a consulta começou e ainda não voltou

    sondagem.parar();
    terminar(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(atualizar).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('garantirAtiva duas vezes não cria duas sondagens', async () => {
    const atualizar = vi.fn(async () => true);
    const sondagem = criarSondagem({ atualizar, intervaloMs: 5_000 });
    sondagem.garantirAtiva();
    sondagem.garantirAtiva();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(atualizar).toHaveBeenCalledTimes(1);
    sondagem.parar();
  });

  it('depois de parar sozinha, pode ser religada (por exemplo, planilha nova ou "tentar agora")', async () => {
    const respostas = [false, true, false];
    const atualizar = vi.fn(async () => respostas.shift() ?? false);
    const sondagem = criarSondagem({ atualizar, intervaloMs: 5_000 });
    sondagem.garantirAtiva();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sondagem.ativa()).toBe(false);

    sondagem.garantirAtiva();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(atualizar).toHaveBeenCalledTimes(3);
    expect(sondagem.ativa()).toBe(false);
  });

  it('a API fora do ar não para a sondagem: tenta de novo em 5 s', async () => {
    const respostas: (() => Promise<boolean>)[] = [() => Promise.reject(new Error('sem rede')), async () => false];
    const atualizar = vi.fn(() => respostas.shift()!());
    const sondagem = criarSondagem({ atualizar, intervaloMs: 5_000 });
    sondagem.garantirAtiva();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(atualizar).toHaveBeenCalledTimes(2);
    expect(sondagem.ativa()).toBe(false);
  });
});
