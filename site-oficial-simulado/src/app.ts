import express, { type Response } from 'express';
import type { Partida } from './dados';
import { PAGINA_DEMO } from './pagina-demo';

export type EstadoSite = 'no_ar' | 'fora_com_erro' | 'sem_resposta';

export interface OpcoesSite {
  demora?: { minMs: number; maxMs: number };
  esperar?: (ms: number) => Promise<void>;
  aleatorio?: () => number;
}

const esperarDeVerdade = (ms: number) => new Promise<void>((pronto) => setTimeout(pronto, ms));

export function criarApp(
  partidas: Map<string, Partida>,
  { demora = { minMs: 0, maxMs: 0 }, esperar = esperarDeVerdade, aleatorio = Math.random }: OpcoesSite = {},
) {
  const app = express();
  app.use(express.json());
  const falhasDadas = new Map<string, number>();
  let estado: EstadoSite = 'no_ar';
  const penduradas = new Set<Response>();

  app.get('/saude', (_req, res) => {
    res.json({ site: 'ok' });
  });

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
    for (const pendurada of penduradas) pendurada.socket?.destroy();
    penduradas.clear();
    res.json({ estado });
  });

  function atenderSeForaDoAr(res: Response, id: string): boolean {
    if (estado === 'fora_com_erro') {
      res.status(503).json({ status: 'indisponivel', motivo: 'site fora do ar', id });
      return true;
    }
    if (estado === 'sem_resposta') {
      penduradas.add(res);
      res.on('close', () => penduradas.delete(res));
      return true;
    }
    return false;
  }

  app.get('/partidas/:id', async (req, res) => {
    const numeros = req.params.id.replace(/^#/, '');
    if (!/^\d+$/.test(numeros)) {
      res.status(400).json({ erro: `ID de partida inválido: "${req.params.id}". Use só os números, como /partidas/40923.` });
      return;
    }
    const id = `#${numeros}`;

    if (atenderSeForaDoAr(res, id)) return;

    await esperar(demora.minMs + Math.floor(aleatorio() * (demora.maxMs - demora.minMs + 1)));

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

    const { falhas_antes_de_responder: _configuracao, ...resposta } = partida;
    res.json(resposta);
  });

  return app;
}
