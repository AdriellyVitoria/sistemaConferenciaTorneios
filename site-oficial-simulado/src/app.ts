import express from 'express';
import type { Partida } from './dados';

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
 */
export function criarApp(
  partidas: Map<string, Partida>,
  { demora = { minMs: 0, maxMs: 0 }, esperar = esperarDeVerdade, aleatorio = Math.random }: OpcoesSite = {},
) {
  const app = express();
  // quantas vezes cada partida já falhou; zera quando o simulador reinicia
  const falhasDadas = new Map<string, number>();

  app.get('/saude', (_req, res) => {
    res.json({ site: 'ok' });
  });

  app.get('/partidas/:id', async (req, res) => {
    const numeros = req.params.id.replace(/^#/, '');
    if (!/^\d+$/.test(numeros)) {
      // pedido mal feito: diferente de "a partida não existe"
      res.status(400).json({ erro: `ID de partida inválido: "${req.params.id}". Use só os números, como /partidas/40923.` });
      return;
    }

    // inteiro entre o mínimo e o máximo, os dois incluídos
    await esperar(demora.minMs + Math.floor(aleatorio() * (demora.maxMs - demora.minMs + 1)));

    const id = `#${numeros}`;
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
