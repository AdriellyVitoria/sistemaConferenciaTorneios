import { Router } from 'express';

export function rotaSaude(verificarBanco: () => Promise<void>): Router {
  const rota = Router();
  rota.get('/saude', async (_req, res) => {
    try {
      await verificarBanco();
      res.json({ api: 'ok', banco: 'ok' });
    } catch {
      res.status(503).json({ api: 'ok', banco: 'erro' });
    }
  });
  return rota;
}
