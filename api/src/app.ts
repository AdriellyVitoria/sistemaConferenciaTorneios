import express, { type NextFunction, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { exigirSenhaDaOrganizadora, rotaAcesso } from './rotas/acesso';
import { rotaSaude } from './rotas/saude';
import { rotasCalculo } from './rotas/calculo';
import { rotasPartidas } from './rotas/partidas';
import { rotasResultado } from './rotas/resultado';
import { rotasPendencias } from './rotas/pendencias';
import { rotasPublico } from './rotas/publico';
import { rotasTorneios } from './rotas/torneios';

export interface Dependencias {
  bd: Knex;
  verificarBanco: () => Promise<void>;
  agora?: () => Date;
  senhaDaOrganizadora: string;
}

export function criarApp({ bd, verificarBanco, agora = () => new Date(), senhaDaOrganizadora }: Dependencias) {
  const app = express();
  app.disable('x-powered-by');

  app.use(rotaSaude(verificarBanco));
  app.use(rotasPublico(bd));

  app.use(exigirSenhaDaOrganizadora(senhaDaOrganizadora));
  app.use(express.json());
  app.use(rotaAcesso());
  app.use(rotasTorneios(bd, agora));
  app.use(rotasPendencias(bd, agora));
  app.use(rotasPartidas(bd, agora));
  app.use(rotasCalculo(bd, agora));
  app.use(rotasResultado(bd));
  app.use(tratarErros);
  return app;
}

function tratarErros(erro: { type?: string; status?: number }, _req: Request, res: Response, _proximo: NextFunction) {
  if (erro.type === 'entity.too.large') {
    res.status(413).json({ erro: 'O arquivo é grande demais. O limite é de 5 MB.' });
    return;
  }
  if (erro.type === 'entity.parse.failed') {
    res.status(400).json({ erro: 'O corpo da requisição não é um JSON válido.' });
    return;
  }
  console.error('Erro inesperado na API:', erro);
  res.status(500).json({ erro: 'Erro inesperado no servidor. Tente de novo.' });
}
