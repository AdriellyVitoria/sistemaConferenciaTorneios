import { createHash, timingSafeEqual } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';

const SEM_ACESSO = { erro: 'Acesso só da organizadora.' };

const resumo = (texto: string) => createHash('sha256').update(texto, 'utf8').digest();

export function exigirSenhaDaOrganizadora(senha: string) {
  const esperado = resumo(senha);
  return (req: Request, res: Response, proximo: NextFunction) => {
    const recebida = /^Bearer (.+)$/i.exec(req.get('authorization') ?? '')?.[1];
    if (recebida !== undefined && timingSafeEqual(resumo(recebida), esperado)) {
      proximo();
      return;
    }
    res.status(401).set('WWW-Authenticate', 'Bearer').json(SEM_ACESSO);
  };
}

export function rotaAcesso(): Router {
  const rota = Router();
  rota.get('/acesso', (_req, res) => {
    res.status(204).end();
  });
  return rota;
}
