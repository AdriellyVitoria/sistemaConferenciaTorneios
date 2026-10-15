/**
 * As páginas abertas por link (D11, etapas 7a e 7b). Sem login: quem tem o código vê.
 *
 *   GET /publico/:codigo   nome, data do cálculo, regras e classificação, sem dado de jogador.
 *   GET /time/:codigo      o extrato dos jogadores de UM time premiado, sem nada dos outros times.
 *
 * Só o resultado congelado (6a): nada é recalculado. Cada código abre só a sua página: o público
 * não abre a de um time, e o de um time não abre a pública. Qualquer erro dá o mesmo 404, com a
 * mesma frase: a resposta não conta se o código tem o formato certo, de que tipo ele é ou se o
 * torneio existe. Todas as respostas levam "X-Robots-Tag: noindex", para o link não aparecer em
 * buscador.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { assincrono } from './assincrono';
import { FORMATO_DO_CODIGO } from '../dominio/codigo-de-acesso';
import { montarPaginaDoTime } from '../dominio/pagina-do-time';
import { montarPaginaPublica } from '../dominio/pagina-publica';
import { buscarPorCodigoDeTime, buscarPorCodigoPublico, buscarResultado } from '../repositorios/resultado';

const NAO_ENCONTRADA = { erro: 'Página não encontrada.' };

function naoIndexar(_req: Request, res: Response, proximo: NextFunction) {
  res.set('X-Robots-Tag', 'noindex');
  proximo();
}

export function rotasPublico(bd: Knex): Router {
  const rota = Router();
  rota.use(['/publico', '/time'], naoIndexar);

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

  rota.get('/time/:codigo', assincrono(async (req, res) => {
    const { codigo } = req.params;
    const time = FORMATO_DO_CODIGO.test(codigo) ? await buscarPorCodigoDeTime(bd, codigo) : null;
    const resultado = time ? await buscarResultado(bd, time.torneioId) : null;
    const pagina = time && resultado ? montarPaginaDoTime(time.nome, resultado, time.time, time.codigoPublico) : null;
    if (!pagina) {
      res.status(404).json(NAO_ENCONTRADA);
      return;
    }
    res.json(pagina);
  }));

  return rota;
}
