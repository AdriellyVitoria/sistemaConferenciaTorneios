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
  /** O relógio; os testes avançam o tempo (bloqueio do "tentar agora") sem esperar. */
  agora?: () => Date;
  /** O ADMIN_SENHA do .env (R3); os testes passam a deles. */
  senhaDaOrganizadora: string;
}

// Monta o app sem abrir porta nem conexão: o servidor e os testes injetam o que precisam.
export function criarApp({ bd, verificarBanco, agora = () => new Date(), senhaDaOrganizadora }: Dependencias) {
  const app = express();
  // não anuncia o Express nem a versão a quem chamar a API (code review, item 18)
  app.disable('x-powered-by');

  // abertas, sem senha: a saúde e as páginas por link dos jogadores (D11)
  app.use(rotaSaude(verificarBanco));
  app.use(rotasPublico(bd));

  // daqui para baixo, só com a senha da organizadora (R3). A senha vem antes de ler o corpo:
  // sem ela, ninguém faz a API ler um JSON ou uma planilha.
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
