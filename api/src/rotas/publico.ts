/**
 * A página pública do torneio (D11, etapa 7a). Sem login: quem tem o código vê.
 *
 *   GET /publico/:codigo   nome, data do cálculo, regras e classificação, sem dado de jogador.
 *
 * Só o resultado congelado (6a): nada é recalculado. Qualquer erro dá o mesmo 404, com a mesma
 * frase: a resposta não conta se o código tem o formato certo, se é de um time ou se o torneio
 * existe. Todas as respostas levam "X-Robots-Tag: noindex", para o link não aparecer em buscador.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { assincrono } from './assincrono';
import { FORMATO_DO_CODIGO } from '../dominio/codigo-de-acesso';
import { montarPaginaPublica } from '../dominio/pagina-publica';
import { buscarPorCodigoPublico, buscarResultado } from '../repositorios/resultado';

const NAO_ENCONTRADA = { erro: 'Página não encontrada.' };

export function rotasPublico(bd: Knex): Router {
  const rota = Router();

  rota.use('/publico', (_req: Request, res: Response, proximo: NextFunction) => {
    res.set('X-Robots-Tag', 'noindex');
    proximo();
  });

  rota.get('/publico/:codigo', assincrono(async (req, res) => {
    const { codigo } = req.params;
    // fora do formato, nem consulta o banco
    const torneio = FORMATO_DO_CODIGO.test(codigo) ? await buscarPorCodigoPublico(bd, codigo) : null;
    const resultado = torneio ? await buscarResultado(bd, torneio.torneioId) : null;
    if (!torneio || !resultado) {
      res.status(404).json(NAO_ENCONTRADA);
      return;
    }
    res.json(montarPaginaPublica(torneio.nome, resultado));
  }));

  return rota;
}
