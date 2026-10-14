import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * O Express 4 não pega erros de rotas async: sem isto, um erro (o banco fora do ar, por exemplo)
 * deixaria a requisição pendurada. Repassa o erro para o tratamento de erros do app.
 */
export function assincrono(rota: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req: Request, res: Response, proximo: NextFunction) => {
    rota(req, res).catch(proximo);
  };
}
