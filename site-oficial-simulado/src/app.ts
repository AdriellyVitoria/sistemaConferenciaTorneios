import express from 'express';
import type { Partida } from './dados';

/**
 * O site oficial simulado. Consulta pelo ID da partida, só com os números:
 * GET /partidas/40923. O "#" não vai na URL porque o navegador trata tudo depois dele como
 * fragmento e nunca o envia ao servidor; "%2340923" (o # codificado) também é aceito.
 */
export function criarApp(partidas: Map<string, Partida>) {
  const app = express();

  app.get('/saude', (_req, res) => {
    res.json({ site: 'ok' });
  });

  app.get('/partidas/:id', (req, res) => {
    const numeros = req.params.id.replace(/^#/, '');
    if (!/^\d+$/.test(numeros)) {
      // pedido mal feito: diferente de "a partida não existe"
      res.status(400).json({ erro: `ID de partida inválido: "${req.params.id}". Use só os números, como /partidas/40923.` });
      return;
    }

    const id = `#${numeros}`;
    const partida = partidas.get(id);
    if (!partida) {
      res.status(404).json({ status: 'nao_encontrada', id });
      return;
    }

    // a configuração do simulador não faz parte do que o site responde
    const { falhas_antes_de_responder: _configuracao, ...resposta } = partida;
    res.json(resposta);
  });

  return app;
}
