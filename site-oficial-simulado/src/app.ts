import express, { type Response } from 'express';
import type { Partida } from './dados';
import { PAGINA_DEMO } from './pagina-demo';

export type EstadoSite = 'no_ar' | 'fora_com_erro' | 'sem_resposta';

export interface OpcoesSite {
  /** Demora de cada consulta, sorteada entre o mínimo e o máximo. Sem isso, responde na hora. */
  demora?: { minMs: number; maxMs: number };
  /** Como esperar; os testes trocam por uma espera que não espera de verdade. */
  esperar?: (ms: number) => Promise<void>;
  /** Sorteio entre 0 (inclusive) e 1 (exclusive), como Math.random; os testes fixam o valor. */
  aleatorio?: () => number;
}

const esperarDeVerdade = (ms: number) => new Promise<void>((pronto) => setTimeout(pronto, ms));

/**
 * O site oficial simulado. Consulta pelo ID da partida, só com os números:
 * GET /partidas/40923. O "#" não vai na URL porque o navegador trata tudo depois dele como
 * fragmento e nunca o envia ao servidor; "%2340923" (o # codificado) também é aceito.
 *
 * Como o site real, cada consulta demora (2 a 10 s por padrão) e algumas partidas falham
 * algumas vezes antes de responder (campo falhas_antes_de_responder): 503 "indisponivel".
 *
 * Modo demonstração (página em GET /demo): o site pode ser derrubado com erro (503 na hora)
 * ou sem resposta (a conexão fica pendurada) e religado. Só as consultas de partida caem;
 * /saude e /demo continuam de pé, senão não daria para religar.
 */
export function criarApp(
  partidas: Map<string, Partida>,
  { demora = { minMs: 0, maxMs: 0 }, esperar = esperarDeVerdade, aleatorio = Math.random }: OpcoesSite = {},
) {
  const app = express();
  app.use(express.json());
  // quantas vezes cada partida já falhou; zera quando o simulador reinicia
  const falhasDadas = new Map<string, number>();
  let estado: EstadoSite = 'no_ar';
  // consultas penduradas pelo modo "sem resposta"; encerradas quando o site é religado
  const penduradas = new Set<Response>();

  app.get('/saude', (_req, res) => {
    res.json({ site: 'ok' });
  });

  // ------------------------------------------------------------- demonstração

  app.get('/demo', (_req, res) => {
    res.type('html').send(PAGINA_DEMO);
  });

  app.get('/demo/estado', (_req, res) => {
    res.json({ estado });
  });

  app.post('/demo/derrubar', (req, res) => {
    const modo = req.body?.modo;
    if (modo !== 'erro' && modo !== 'sem_resposta') {
      res.status(400).json({ erro: `Modo de queda desconhecido: "${modo}". Use "erro" ou "sem_resposta".` });
      return;
    }
    estado = modo === 'erro' ? 'fora_com_erro' : 'sem_resposta';
    res.json({ estado });
  });

  app.post('/demo/religar', (_req, res) => {
    estado = 'no_ar';
    // as consultas penduradas viram conexões perdidas, sem resposta tardia
    for (const pendurada of penduradas) pendurada.socket?.destroy();
    penduradas.clear();
    res.json({ estado });
  });

  /** Se o site estiver derrubado, responde (ou pendura) a consulta e devolve true. */
  function atenderSeForaDoAr(res: Response, id: string): boolean {
    if (estado === 'fora_com_erro') {
      res.status(503).json({ status: 'indisponivel', motivo: 'site fora do ar', id });
      return true;
    }
    if (estado === 'sem_resposta') {
      penduradas.add(res);
      res.on('close', () => penduradas.delete(res));
      return true; // não responde nada
    }
    return false;
  }

  // ----------------------------------------------------------------- consulta

  app.get('/partidas/:id', async (req, res) => {
    const numeros = req.params.id.replace(/^#/, '');
    if (!/^\d+$/.test(numeros)) {
      // pedido mal feito: diferente de "a partida não existe"
      res.status(400).json({ erro: `ID de partida inválido: "${req.params.id}". Use só os números, como /partidas/40923.` });
      return;
    }
    const id = `#${numeros}`;

    // site derrubado: cai na hora, sem a demora e sem gastar as falhas da partida
    if (atenderSeForaDoAr(res, id)) return;

    // inteiro entre o mínimo e o máximo, os dois incluídos
    await esperar(demora.minMs + Math.floor(aleatorio() * (demora.maxMs - demora.minMs + 1)));

    // o site pode ter caído enquanto a consulta esperava
    if (atenderSeForaDoAr(res, id)) return;

    const partida = partidas.get(id);
    if (!partida) {
      res.status(404).json({ status: 'nao_encontrada', id });
      return;
    }

    const falhas = falhasDadas.get(id) ?? 0;
    if (falhas < (partida.falhas_antes_de_responder ?? 0)) {
      falhasDadas.set(id, falhas + 1);
      res.status(503).json({ status: 'indisponivel', id });
      return;
    }

    // a configuração do simulador não faz parte do que o site responde
    const { falhas_antes_de_responder: _configuracao, ...resposta } = partida;
    res.json(resposta);
  });

  return app;
}
