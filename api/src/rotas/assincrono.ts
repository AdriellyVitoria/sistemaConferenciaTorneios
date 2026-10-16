import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function assincrono(rota: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req: Request, res: Response, proximo: NextFunction) => {
    rota(req, res).catch(proximo);
  };
}
