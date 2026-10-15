import express, { type NextFunction, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { rotaSaude } from './rotas/saude';
import { rotasCalculo } from './rotas/calculo';
import { rotasPartidas } from './rotas/partidas';
import { rotasPendencias } from './rotas/pendencias';
import { rotasTorneios } from './rotas/torneios';

export interface Dependencias {
  bd: Knex;
  verificarBanco: () => Promise<void>;
  /** O relógio; os testes avançam o tempo (bloqueio do "tentar agora") sem esperar. */
  agora?: () => Date;
}

// Monta o app sem abrir porta nem conexão: o servidor e os testes injetam o que precisam.
export function criarApp({ bd, verificarBanco, agora = () => new Date() }: Dependencias) {
  const app = express();
  app.use(express.json());
  app.use(rotaSaude(verificarBanco));
  app.use(rotasTorneios(bd, agora));
  app.use(rotasPendencias(bd, agora));
  app.use(rotasPartidas(bd, agora));
  app.use(rotasCalculo(bd, agora));
  app.use(tratarErros);
  return app;
}

/** Toda resposta de erro em JSON, com uma frase que a tela pode mostrar. */
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
