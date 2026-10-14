import { Router } from 'express';

/**
 * GET /saude: diz se a API está no ar e se consegue falar com o banco.
 * Recebe a verificação do banco por parâmetro para a rota poder ser testada sem MySQL.
 */
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
