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

  rota.all(['/publico', '/publico/*', '/time', '/time/*'], (_req, res) => {
    res.status(404).json(NAO_ENCONTRADA);
  });

  return rota;
}
